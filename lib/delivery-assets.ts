export type ValidatedDeliveryAsset = {
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number | null;
};

export function validateDeliveryAssets(
  bookingId: string,
  incoming: unknown,
): ValidatedDeliveryAsset[] {
  if (
    !Array.isArray(incoming) ||
    incoming.length < 1 ||
    incoming.length > 100
  ) {
    throw new Error('Provide between 1 and 100 uploaded assets.');
  }
  const paths = new Set<string>();
  return incoming.map((item: unknown) => {
    if (!item || typeof item !== 'object')
      throw new Error('Invalid delivery asset.');
    const asset = item as Record<string, unknown>;
    if (
      typeof asset.path !== 'string' ||
      !asset.path.startsWith(bookingId + '/')
    )
      throw new Error('Invalid delivery asset path.');
    const file = asset.path.slice(bookingId.length + 1);
    if (!/^[a-zA-Z0-9._-]{1,200}$/.test(file) || file === '.' || file === '..')
      throw new Error('Invalid delivery asset path.');
    if (paths.has(asset.path))
      throw new Error('Duplicate delivery asset path.');
    paths.add(asset.path);
    if (
      typeof asset.fileName !== 'string' ||
      !asset.fileName.trim() ||
      asset.fileName.length > 120 ||
      /[\u0000-\u001f\u007f]/.test(asset.fileName)
    )
      throw new Error('Invalid delivery file name.');
    if (
      typeof asset.mimeType !== 'string' ||
      !/^(image|video)\/[a-zA-Z0-9.+-]+$/.test(asset.mimeType)
    )
      throw new Error('Only photo and video delivery files are supported.');
    if (
      asset.sizeBytes != null &&
      (typeof asset.sizeBytes !== 'number' ||
        !Number.isSafeInteger(asset.sizeBytes) ||
        asset.sizeBytes <= 0 ||
        asset.sizeBytes > 500 * 1024 * 1024)
    )
      throw new Error('Each file must be between 1 byte and 500 MB.');
    return {
      storage_path: asset.path,
      file_name: asset.fileName.trim(),
      mime_type: asset.mimeType,
      size_bytes: asset.sizeBytes == null ? null : (asset.sizeBytes as number),
    };
  });
}
