import { useState } from 'react';
import { Button } from 'react-bootstrap';
import {
  collectFilesFromHandle,
  pickDirectory,
  supportsDirectoryPicker,
} from './upload/core/dirHandles';

/** Button-styled file picker that returns selected files as an array. */
// React's DOM types omit Chromium's webkitdirectory attribute.
declare module 'react' {
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    webkitdirectory?: string;
  }
}

export default function FileInput({
  id,
  fileType,
  onFileChange,
  onDirectoryHandle,
  children,
  ...fileProps
}: {
  id: string;
  fileType?: string;
  onFileChange: (file: File[]) => void;
  /** Directory handle used to resume Chromium folder uploads. */
  onDirectoryHandle?: (handle: unknown) => void;
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
    if (typeof additionalOnChange === 'function') {
      additionalOnChange(event);
    }
  };

  // Use showDirectoryPicker when possible so callers can persist the handle.
  const isDirectoryPick = fileProps.webkitdirectory !== undefined;
  if (isDirectoryPick && supportsDirectoryPicker()) {
    const handlePick = async () => {
      try {
        const handle = await pickDirectory();
        if (!handle) return;
        const files = await collectFilesFromHandle(handle);
        setFileNames([handle.name]);
        onFileChange(files);
        onDirectoryHandle?.(handle);
      } catch (err) {
        console.error('Directory pick failed:', err);
      }
    };
    return (
      <div className='d-flex flex-row align-items-center gap-2'>
        <Button style={{ width: 'fit-content' }} onClick={handlePick}>
          {children}
        </Button>
        {fileNames.length > 0 && <i className='mb-0'>{fileNames.join(', ')}</i>}
      </div>
    );
  }

  return (
    <div className='d-flex flex-row align-items-center gap-2'>
      <Button style={{ width: 'fit-content' }} as='label' htmlFor={id}>
        {children}
        <input
          id={id}
          type='file'
          accept={fileType || '*'}
          multiple={true}
          onChange={handleChange}
          style={{ display: 'none', ...additionalStyle }}
          {...otherProps}
        />
      </Button>
      {fileNames.length > 0 && (
        <i className='mb-0'>
          {fileNames.join(', ').slice(0, 50)}
          {fileNames.join(', ').length > 50 ? '...' : ''}
        </i>
      )}
    </div>
  );
}
