import { DOCX_MIME_TYPE, MAX_DOCX_UPLOAD_BYTES } from '../../core/config/google-drive.config';

export type DocxValidationError = 'required' | 'extension' | 'mime-type' | 'empty' | 'too-large';

export function validateDocxFile(file: File | null): DocxValidationError | null {
  if (!file) return 'required';
  if (!file.name.toLowerCase().endsWith('.docx')) return 'extension';
  if (file.type !== DOCX_MIME_TYPE) return 'mime-type';
  if (file.size === 0) return 'empty';
  if (file.size > MAX_DOCX_UPLOAD_BYTES) return 'too-large';
  return null;
}

export function docxValidationMessage(error: DocxValidationError): string {
  switch (error) {
    case 'required':
      return 'Choose a DOCX file to upload.';
    case 'extension':
      return 'Only files with the .docx extension are accepted.';
    case 'mime-type':
      return 'The selected file is not identified as a Microsoft Word DOCX file.';
    case 'empty':
      return 'The selected DOCX file is empty.';
    case 'too-large':
      return 'The DOCX file must be 10 MB or smaller.';
  }
}
