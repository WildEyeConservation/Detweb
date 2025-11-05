interface Image {
  name: string;
  s3key?: string;
  getFile?: () => Promise<File>;
}

interface Entry {
  name: string;
  getFile: () => Promise<File>;
}

let getterCache: Record<string, () => Promise<string>> = {};
let promiseCache: Record<string, Promise<string>> = {};

interface CustomStorage {
  get(key: string, options: { expires: number }): Promise<string>;
}

declare const Storage: CustomStorage;

export async function getUrl(image: Image): Promise<string | void> {
  const { name, s3key } = image;
  if (!(name in promiseCache)) {
    if (name in getterCache) {
      promiseCache[name] = getterCache[name]();
    } else {
      if (s3key) {
        promiseCache[name] = Storage.get(s3key, { expires: 3600 });
      } else {
        alert(
          `Could not find a local or remote source for the image ${image.name}`
        );
      }
    }
  }
  return promiseCache[name];
}

export function addLocal(entry: Entry) {
  getterCache[entry.name] = async () =>
    entry.getFile().then((file) => URL.createObjectURL(file));
}
