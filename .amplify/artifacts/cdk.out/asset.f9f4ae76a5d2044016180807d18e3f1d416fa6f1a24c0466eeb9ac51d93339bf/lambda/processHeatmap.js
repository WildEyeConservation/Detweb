const AWS = require('aws-sdk');
const { GraphQLClient, gql } = require('graphql-request');
const fs = require('fs');
const path = require('path');
const os = require('os');
const h5js = require('h5js');
const ndarray = require('ndarray');
const ops = require('ndarray-ops');
//const skimage = require('skimage');

const s3 = new AWS.S3();
const sqs = new AWS.SQS();
const queueUrl = process.env.QUEUE_URL;
const apiEndpoint = process.env.API_ENDPOINT;

class MobileNetNormalProjector {
    constructor() {
        this.offset = 0;
        this.stride = 32.0;
    }

    hmToVis(hmXy) {
        const visX = hmXy.x * this.stride + this.offset;
        const visY = hmXy.y * this.stride + this.offset;
        return [visX, visY];
    }
}

class MultiTypeBlockPointFinder {
    constructor(smoothingFlag = true, blockWidth = 1024, blockHeight = 1024, threshold = 0.8, smoothingDl = 10) {
        this.threshold = threshold;
        this.smoothingFlag = smoothingFlag;
        this.smoothingDl = smoothingDl;
        this.bheight = Math.floor(blockHeight / 32);
        this.bwidth = Math.floor(blockWidth / 32);
    }

    smooth(npArray) {
        const height = npArray.shape[0];
        const width = npArray.shape[1];
        const smoothedArray = ndarray(new Float32Array(height * width), [height, width]);

        const kernelSize = this.smoothingDl;
        const halfKernel = Math.floor(kernelSize / 2);

        for (let i = 0; i < height; i++) {
            for (let j = 0; j < width; j++) {
                let maxVal = -Infinity;
                for (let ki = -halfKernel; ki <= halfKernel; ki++) {
                    for (let kj = -halfKernel; kj <= halfKernel; kj++) {
                        const ni = i + ki;
                        const nj = j + kj;
                        if (ni >= 0 && ni < height && nj >= 0 && nj < width) {
                            maxVal = Math.max(maxVal, npArray.get(ni, nj));
                        }
                    }
                }
                smoothedArray.set(i, j, maxVal);
            }
        }

        return smoothedArray;
    }

    computeHmValues(block) {
        const sum = ops.sum(block);
        const max = ops.max(block);
        return [sum, max];
    }

    label(binaryImage) {
        const height = binaryImage.shape[0];
        const width = binaryImage.shape[1];
        const labeledImage = ndarray(new Int32Array(height * width), [height, width]);
        let currentLabel = 1;

        function dfs(i, j, label) {
            if (i < 0 || i >= height || j < 0 || j >= width || binaryImage.get(i, j) === 0 || labeledImage.get(i, j) !== 0) {
                return;
            }
            labeledImage.set(i, j, label);
            dfs(i - 1, j, label);
            dfs(i + 1, j, label);
            dfs(i, j - 1, label);
            dfs(i, j + 1, label);
        }

        for (let i = 0; i < height; i++) {
            for (let j = 0; j < width; j++) {
                if (binaryImage.get(i, j) === 1 && labeledImage.get(i, j) === 0) {
                    dfs(i, j, currentLabel);
                    currentLabel++;
                }
            }
        }

        return labeledImage;
    }

    regionprops(labeledImage, intensityImage) {
        const height = labeledImage.shape[0];
        const width = labeledImage.shape[1];
        const regions = new Map();

        for (let i = 0; i < height; i++) {
            for (let j = 0; j < width; j++) {
                const label = labeledImage.get(i, j);
                if (label !== 0) {
                    if (!regions.has(label)) {
                        regions.set(label, {
                            bbox: [i, j, i, j],
                            area: 0,
                            sum_intensity: 0,
                            centroid: [0, 0]
                        });
                    }
                    const region = regions.get(label);
                    region.bbox[0] = Math.min(region.bbox[0], i);
                    region.bbox[1] = Math.min(region.bbox[1], j);
                    region.bbox[2] = Math.max(region.bbox[2], i);
                    region.bbox[3] = Math.max(region.bbox[3], j);
                    region.area++;
                    region.sum_intensity += intensityImage.get(i, j);
                    region.centroid[0] += i;
                    region.centroid[1] += j;
                }
            }
        }

        return Array.from(regions.values()).map(region => {
            region.centroid[0] /= region.area;
            region.centroid[1] /= region.area;
            return {
                bbox: region.bbox,
                area: region.area,
                mean_intensity: region.sum_intensity / region.area,
                centroid: region.centroid
            };
        });
    }

    detect(heatmap) {
        if (this.smoothingFlag) {
            heatmap = this.smooth(heatmap);
        }

        const hmThreshed = ops.gts(heatmap, this.threshold);
        const labels = this.label(hmThreshed);
        const regions = this.regionprops(labels, heatmap);

        const pts = [];

        for (const region of regions) {
            const bbox = region.bbox;
            const bw = bbox[3] - bbox[1];
            const bh = bbox[2] - bbox[0];

            const numWDivs = Math.ceil(bw / this.bwidth);
            const wBlocks = Math.floor(numWDivs * this.bwidth);
            const wDiff = wBlocks - bw;
            const wStart = Math.floor(bbox[1] - wDiff / 2);

            const numHDivs = Math.ceil(bh / this.bheight);
            const hBlocks = Math.floor(numHDivs * this.bheight);
            const hStart = Math.floor(bbox[0] - (hBlocks - bh) / 2);

            for (let w = wStart; w < wStart + wBlocks; w += this.bwidth) {
                const wEnd = Math.min(w + this.bwidth, heatmap.shape[1]);
                const wBegin = Math.max(w, 0);

                for (let h = hStart; h < hStart + hBlocks; h += this.bheight) {
                    const hEnd = Math.min(h + this.bheight, heatmap.shape[0]);
                    const hBegin = Math.max(h, 0);

                    const block = hmThreshed.lo(hBegin, wBegin).hi(hEnd - hBegin, wEnd - wBegin);
                    if (ops.sum(block) > 0) {
                        const x = Math.floor((wBegin + wEnd) / 2);
                        const y = Math.floor((hBegin + hEnd) / 2);
                        const hmValues = this.computeHmValues(heatmap.lo(hBegin, wBegin).hi(hEnd - hBegin, wEnd - wBegin));
                        pts.push({
                            x,
                            y,
                            features: {
                                hm_block_sum: hmValues[0],
                                hm_block_max: hmValues[1]
                            }
                        });
                    }
                }
            }
        }

        return pts;
    }
}

function processHeatmap(filePath, width, height, threshold) {
    const proj = new MobileNetNormalProjector();
    const blockFinder = new MultiTypeBlockPointFinder(true, width, height, threshold);

    const h5file = h5js.readFile(filePath);
    const heatmap = ndarray(h5file.get('heatmap').value, h5file.get('heatmap').shape);

    const hmXyvs = blockFinder.detect(heatmap);
    return hmXyvs.map(hmXyv => {
        const [visX, visY] = proj.hmToVis(hmXyv);
        return {
            x: visX,
            y: visY,
            confidence: hmXyv.features.hm_block_max
        };
    });
}

exports.handler = async (event) => {
    try {
        const response = await sqs.receiveMessage({
            QueueUrl: queueUrl,
            MaxNumberOfMessages: 1,
            VisibilityTimeout: 120,
            WaitTimeSeconds: 0
        }).promise();

        if (!response.Messages) {
            console.log('Queue empty.');
            return;
        }

        for (const message of response.Messages) {
            const body = JSON.parse(message.Body);
            const { bucket, key, width, height, threshold, setId, imageId, projectId } = body;

            const filePath = path.join(os.tmpdir(), path.basename(key));
            const file = fs.createWriteStream(filePath);

            await new Promise((resolve, reject) => {
                s3.getObject({ Bucket: bucket, Key: key })
                    .createReadStream()
                    .pipe(file)
                    .on('finish', resolve)
                    .on('error', reject);
            });

            const points = processHeatmap(filePath, width, height, threshold);

            const client = new GraphQLClient(apiEndpoint, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            for (const point of points) {
                const mutation = gql`
                    mutation MyMutation($confidence: Float, $height: Int, $imageId: ID!, $projectId: ID="", $setId: ID!, $source: String!, $width: Int, $x: Int!, $y: Int!) {
                        createLocation(input: {confidence: $confidence, height: $height, imageId: $imageId, projectId: $projectId, setId: $setId, source: $source, x: $x, y: $y, width: $width}) {
                            id
                        }
                    }
                `;
                const variables = {
                    height,
                    imageId,
                    projectId,
                    x: point.x,
                    y: point.y,
                    width,
                    setId,
                    confidence: point.confidence,
                    source: 'heatmap'
                };

                await client.request(mutation, variables);
            }

            await sqs.deleteMessage({
                QueueUrl: queueUrl,
                ReceiptHandle: message.ReceiptHandle
            }).promise();

            // Clean up temporary file
            fs.unlinkSync(filePath);
        }
    } catch (error) {
        console.error('Error processing message:', error);
    }
};