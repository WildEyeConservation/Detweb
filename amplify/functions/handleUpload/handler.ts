import  fs  from 'node:fs/promises'
import  path  from 'node:path'
import ExifReader from 'exifreader'
import { DateTime } from 'luxon'
import pLimit from 'p-limit'
import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { marshall } from '@aws-sdk/util-dynamodb'
const s3 = new S3Client();
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';
//import {doAppsyncQueryWithPagination, doAppsyncQuery} from './appsync.js'
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import sharp from 'sharp';
import { S3Event } from 'aws-lambda';
import { Readable } from 'stream';
const dynamoDb = new DynamoDBClient();

const TABLE_NAME = process.env.IMAGETABLE;
async function uploadDir(localDir : string, s3Prefix: string) {
  const files = await fs.readdir(localDir);

  // Limit to 3 concurrent file uploads
  const limit = pLimit(3);

  const uploadPromises = files.map((file) =>
    limit(async () => {
      const localPath = path.join(localDir, file);
      const s3Path = `${s3Prefix}/${file}`;

      const stats = await fs.stat(localPath);
      if (stats.isFile()) {
        return s3.send(
          new PutObjectCommand({
            Bucket: process.env.OUTPUTBUCKET,
            Key: s3Path,
            Body: await fs.readFile(localPath),
          }),
        );
      } else if (stats.isDirectory()) {
        return uploadDir(localPath, s3Path);
      }
    }),
  );

  await Promise.all(uploadPromises);
}

/* This function was created because I had a bug in my lambda function at one stage that caused it to terminate early.
This meant that in many cases there were some tiles missing from the output, even though most were uploaded. I obviously 
had to rerun the lambda function, but limits on scaling and processing a very large dataset meant that this took a long time
to complete, whic was a shame because missing files were really quite rare and most files didn't need to be reprocessed at all.

Unfortunately there is no perfect mechanism (that I can think of), to check whether a particular image pyramid is complete in general.
I came up with the following hack that checks for a certain number of files in zoom level 5. Because all my images were the same size, 
this would work, but it is not a general solution. 

I don't expect to need this code again, but leave it here for future reference.*/
async function existsOnS3(client: S3Client, bucket: string, prefix: string) {
  try {
    const data = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }),
    );
    const exists = (data.Contents?.length || 0) >= 494;
    return exists;
  } catch (error) {
    if (
      (error as any).$metadata?.httpStatusCode === 404 ||
      (error as any).$metadata?.httpStatusCode === 403
    ) {
      return false;
    } else {
      throw error;
    }
  }
}

const assumeRole = async (roleArn: string) => {
  const stsClient = new STSClient({ region: process.env.AWS_REGION });
  const command = new AssumeRoleCommand({
    RoleArn: roleArn,
    RoleSessionName: 'LambdaLocalDebugSession'
  });

  try {
    const response = await stsClient.send(command);
    return {
      accessKeyId: response.Credentials?.AccessKeyId,
      secretAccessKey: response.Credentials?.SecretAccessKey,
      sessionToken: response.Credentials?.SessionToken,
    };
  } catch (error) {
    console.error('Error assuming role:', error);
    throw error;
  }
};


export async function lambdaHandler(event:S3Event) {
  // Assume role if running locally
  if (process.env.AWS_SAM_LOCAL) {
    const roleArn = process.env.AWS_ROLE_ARN;
    if (!roleArn) {
      throw new Error('AWS_ROLE_ARN environment variable is not set');
    }
    const credentials = await assumeRole(roleArn);
    // Set the credentials for this session
    process.env.AWS_ACCESS_KEY_ID = credentials.accessKeyId;
    process.env.AWS_SECRET_ACCESS_KEY = credentials.secretAccessKey;
    process.env.AWS_SESSION_TOKEN = credentials.sessionToken;
  }
  console.log("Starting");
  console.log(`EVENT: ${JSON.stringify(event)}`);
  for (const record of event.Records) {
    var {
      s3: {
        bucket: { name: Bucket },
        object: { key: Key },
      },
      eventName,
    } = record;
    Key = decodeURIComponent(Key.replace(/\+/g, " "));
    const upperkey = Key.toUpperCase();
    // Check if the event is an object creation event and if the object is an image that we can read. 
    // TODO: We can probably allready support a range of other input formats (bmp, png, tiff, gif, webp etc) allready. Confirm that these
    // work and add them to the list of supported input formats.
    // TODO: there are some other formats that we definitely don't support yet, but should be quite useful. I'm thinking here mainly of the raw formats
    // (CR2, CR3, NEF, ARW etc). Try to add support for these at some point.
    if (
      eventName.startsWith("ObjectCreated") &&
      Key.startsWith("images/") &&
      (upperkey.endsWith(".JPEG") || upperkey.endsWith(".JPG"))
    ) {
      // console.log("Checking for output presence");
      // const exists = await existsOnS3(
      //   s3,
      //   process.env.OUTPUTBUCKET,
      //   outputS3Prefix + "/5",
      // );
      console.log(`Fetching file from ${Bucket}/${Key}...`);
      const getObjectResponse = await s3.send(
        new GetObjectCommand({ Bucket, Key }),
      );
      const chunks = [];    
      if (getObjectResponse.Body instanceof Readable) {
        for await (const chunk of getObjectResponse.Body) {
          chunks.push(chunk);
        }
      }
      const buffer = Buffer.concat(chunks);
      const localTmpPath = "/tmp/tiles";
      // Read the exif data from the image stored in buffer.
      const tags = ExifReader.load(buffer);
      //Drop all tags with a length longer than 100 characters
    //   let tagsDD = {}
      for (const tag of Object.keys(tags)) {
        if (tags[tag]?.description?.length > 100) {
          console.log(`Tag ${tag} has a description longer than 100 characters. Dropping it.`)
          console.log(tags[tag].description)
          delete tags[tag];
        }
      }
      delete tags.MakerNote
    //   Object.keys(tags).forEach(key => { tagsDD[key] = tags[key]?.description })
    //   tagsDD['key'] = Key.substring('public/images/'.length)
    //   /*tags.DateTimeOriginal.value[0]
    //   '2023:11:14 09:52:39'*/
    //   tagsDD['timestamp'] = DateTime.fromFormat(tags.DateTimeOriginal.value[0], 'yyyy:MM:dd HH:mm:ss').toUnixInteger()
    //   // tagsDD['height'] = tags.ImageHeight.value
    //   // tagsDD['width'] = tags.ImageWidth.value
    //   tagsDD['createdAt'] = DateTime.now().toISO()
    //   tagsDD['updatedAt'] = DateTime.now().toISO()
    //   tagsDD['__typename'] = 'Image'
      // delete tagsDD['ImageHeight']
      // delete tagsDD['ImageWidth']

    //   const config={
    //     TableName: TABLE_NAME,
    //     Item: marshall(tagsDD, { removeUndefinedValues: true , convertEmptyValues: false}),
    //   }
      // const config={
      //   TableName: TABLE_NAME,
      //   Item: { key: { 'S': 'testItem' }},
      // }
    //   const putItemCommand = new PutItemCommand(config);
    //   const result=await dynamoDb.send(putItemCommand);
    //   console.log(result)

      // const input={
      //   key,
      //   shutterSpeed: tags.ExposureTime.value[0]/tags.ExposureTime.value[1],
      //   aperture: tags.FNumber.value[0] / tags.Fnumber.value[1],
      //   iso: tags.ISOSpeedRatings.value,
      //   focalLength: tags.FocalLength.value[0] / tags.FocalLength.value[1],
      //   make: tags.Make.value,
      //   model: tags.Model.value,
      //   orientation: tags.Orientation.value,
      //   dateTime: DateTime.fromJSDate(tags.DateTimeOriginal.value).toISO(),
      //   /*tags.DateTimeOriginal.value[0]
      //   '2023:11:14 09:52:39' 
      //   so parse to ISO as follows*/
      //   dateTime: DateTime.fromFormat(tags.DateTimeOriginal.value[0], 'yyyy:MM:dd HH:mm:ss').toISO(),
               

      //     "key": Key
      //   },
      //   "exif": tags
      // }
      // const query = `
      
      // `

      


      /* Sharp is causing me a little bit of pain in my local testing environment. I know that this part of the
      code works, so for now I am simply excluding it from local testing. */
      if (typeof process.env.AWS_SAM_LOCAL === 'undefined') {
        //const sharp = await import('sharp');
        //const sharp = require('sharp')
        console.log("File fetched. Processing with sharp...");
        await sharp(buffer)
          .png()
          .tile({ layout: "google" })
          .toFile(localTmpPath);  
      } else {
        console.log('Running in local testing mode, sharp module not loaded');
        // Create a fake output directory for testing purposes
        await fs.mkdir(localTmpPath, { recursive: true });
      }
      const outputS3Prefix = Key.replace("images", "slippymaps");
      console.log(`Uploading ${localTmpPath}`);
      await uploadDir(localTmpPath, outputS3Prefix);
      console.log("Done");
    }
  }
};
