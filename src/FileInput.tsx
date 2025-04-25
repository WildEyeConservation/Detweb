import { useState } from "react";
import { Button } from "react-bootstrap";

/**
 * A file input component that wraps a button and displays selected file names.
 *
 * @remarks
 * This component handles multiple file selection by default. To work with a single file,
 * access the first element of the files array passed to onFileChange (files[0]).
 *
 * @param props
 * @param props.id - Unique identifier for the input element
 * @param props.fileType - Accepted file type(s) (e.g. ".csv", ".jpg,.png")
 * @param props.onFileChange - Callback function that receives the selected File array
 * @param props.children - Content to display inside the button
 *
 * @example
 * // For single file handling:
 * <FileInput
 *   id="myInput"
 *   fileType=".csv"
 *   onFileChange={(files) => handleSingleFile(files[0])}
 * >
 *   Select File
 * </FileInput>
 *
 * // For multiple file handling:
 * <FileInput
 *   id="myInput"
 *   fileType=".csv"
 *   onFileChange={(files) => handleMultipleFiles(files)}
 * >
 */

/* JJN - I don't understand why I need to tell Typescript that webkitdirectory is one of the fields of the input element.
  Without this, Typescript complains that webkitdirectory is not a valid attribute for an input element.
  Some discussion at https://stackoverflow.com/questions/71444475/webkitdirectory-in-typescript-and-react 
  This can probably solved in a better way. I am moving on for now.
*/

declare module "react" {
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    webkitdirectory?: string;
  }
}

export default function FileInput({
  id,
  fileType,
  onFileChange,
  children,
  ...fileProps
}: {
  id: string;
  fileType?: string;
  onFileChange: (file: File[]) => void;
  children: React.ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const [fileNames, setFileNames] = useState<string[]>([]);

  const {
    onChange: additionalOnChange,
    style: additionalStyle,
    ...otherProps
  } = fileProps;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const filesArray = Array.from(event.target.files);
      setFileNames(filesArray.map((file) => file.name));
      onFileChange(filesArray);
    }
    if (typeof additionalOnChange === "function") {
      additionalOnChange(event);
    }
  };

  return (
    <div className="d-flex flex-row align-items-center gap-2">
      <Button style={{ width: "fit-content" }} as="label" htmlFor={id}>
        {children}
        <input
          id={id}
          type="file"
          accept={fileType || "*"}
          multiple={true}
          onChange={handleChange}
          style={{ display: "none", ...additionalStyle }}
          {...otherProps}
        />
      </Button>
      {fileNames.length > 0 && (
        <i className="mb-0">
          {fileNames.join(", ").slice(0, 50)}
          {fileNames.join(", ").length > 50 ? "..." : ""}
        </i>
      )}
    </div>
  );
}
