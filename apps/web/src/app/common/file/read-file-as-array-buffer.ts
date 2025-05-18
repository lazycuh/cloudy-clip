export async function readFileAsArrayBuffer(file: File) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const fileReader = new FileReader();

    fileReader.onload = () => {
      fileReader.onload = null;
      fileReader.onerror = null;

      resolve(fileReader.result as ArrayBuffer);
    };

    fileReader.onerror = () => {
      fileReader.onload = null;
      fileReader.onerror = null;

      reject(fileReader.error!);
    };

    fileReader.readAsArrayBuffer(file);
  });
}
