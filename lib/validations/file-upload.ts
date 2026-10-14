export const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export function validateFileSize(
  file: File,
  maxSize: number = MAX_ATTACHMENT_SIZE_BYTES
): { valid: boolean; error?: string } {
  if (file.size > maxSize) {
    const sizeInMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `O arquivo "${file.name}" (${sizeInMb}MB) excede o limite máximo permitido de 5MB.`,
    };
  }
  return { valid: true };
}

export function validateMultipleFiles(
  files: File[],
  maxSize: number = MAX_ATTACHMENT_SIZE_BYTES
): { valid: boolean; error?: string; invalidFiles: File[] } {
  const invalidFiles = files.filter((f) => f.size > maxSize);
  if (invalidFiles.length > 0) {
    const names = invalidFiles.map((f) => `"${f.name}" (${(f.size / (1024 * 1024)).toFixed(1)}MB)`).join(', ');
    return {
      valid: false,
      invalidFiles,
      error: `Os seguintes arquivos excedem o limite de 5MB: ${names}.`,
    };
  }
  return { valid: true, invalidFiles: [] };
}
