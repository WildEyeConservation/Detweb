import { useLeafletContext } from "@react-leaflet/core";
import L from "leaflet";
import { useEffect } from "react";
import { getUrl } from 'aws-amplify/storage';
/* This is a custom Leaflet layer that uses a slippy map stored on S3 storage, accessed via the aws-sdk/aws-s3
library. Because the URLs that we use to access files stored there need to be individually signed, we cannot 
use a URL template in the way that the normal Leaflet TileLayer does. 

The amplify Storage library gives a slightly more convenient interface, but it can only support a single S3 bucket.
Having now placed our inputs and outputs in separate buckets, we find that we need to access at least one of these via raw S3.*/

let cachedUrlPromises: { [key: string]: Promise<string> } = {};

interface leafletS3LayerOptions extends L.GridLayerOptions {
  getObject: (params: { Bucket: string; Key: string }) => Promise<any>;
  source: string;
}

class leafletS3Layer extends L.GridLayer {
  private source: string;
  
  constructor(opts: leafletS3LayerOptions) {
    super(opts);
    this.source = opts.source;
  }

  createTile(coords: L.Coords, done: (error: Error | undefined, tile: HTMLElement) => void) {
    let tile = document.createElement("img");
    const path = `slippymaps/${this.source}/${coords.z}/${coords.y}/${coords.x}.png`
    if (!(path in cachedUrlPromises)) {
      // Get a blob URL
      cachedUrlPromises[path] = getUrl({ path })
    }
    cachedUrlPromises[path].then(url => {
      tile.src = url.url;
      setTimeout(() => {
        done(undefined, tile);
      }, 1);
    })
    return tile
  }
}

interface S3LayerProps extends leafletS3LayerOptions {}

export function StorageLayer(props: S3LayerProps) {
  const context = useLeafletContext();
//  const { getObject } = useContext(UserContext)!;

  useEffect(() => {
    const s3layer = new leafletS3Layer({ ...props});
    const container = context.layerContainer || context.map;
    container.addLayer(s3layer);
    return () => {
      container.removeLayer(s3layer);
    };
  }, [props, context]);
  return null;
}
