export type WorkChoice = 'photography' | 'videography' | 'both';
export type DeviceChoice = 'camera' | 'phone' | 'both';

// Keep the deployed application's skills[] contract. Readable capability tags
// also appear in the existing admin review screen; they do not grant job access.
const managedTag = (value: string) =>
  /^(photography|videography|equipment: (camera|phone))$/i.test(value) ||
  /^(camera|phone) model:/i.test(value);

export function readOnboarding(values: string[] = []) {
  const tags = values.map((value) => value.trim());
  const has = (tag: string) =>
    tags.some((value) => value.toLowerCase() === tag.toLowerCase());
  const photo = has('Photography');
  const video = has('Videography');
  const camera = has('Equipment: Camera');
  const phone = has('Equipment: Phone');
  return {
    work: (photo && video
      ? 'both'
      : photo
        ? 'photography'
        : video
          ? 'videography'
          : null) as WorkChoice | null,
    device: (camera && phone
      ? 'both'
      : camera
        ? 'camera'
        : phone
          ? 'phone'
          : null) as DeviceChoice | null,
    cameraModel:
      tags
        .find((value) => /^camera model:/i.test(value))
        ?.replace(/^camera model:\s*/i, '') || '',
    phoneModel:
      tags
        .find((value) => /^phone model:/i.test(value))
        ?.replace(/^phone model:\s*/i, '') || '',
    extraSkills: tags.filter((value) => !managedTag(value)).join(', '),
  };
}

export function buildOnboarding(values: {
  work: WorkChoice | null;
  device: DeviceChoice | null;
  cameraModel: string;
  phoneModel: string;
  extraSkills: string;
}) {
  if (!values.work) throw new Error('Choose Photography, Videography or Both.');
  if (!values.device) throw new Error('Choose Camera, Phone or Both.');
  const tags: string[] = [];
  if (values.work !== 'videography') tags.push('Photography');
  if (values.work !== 'photography') tags.push('Videography');
  if (values.device !== 'phone') {
    tags.push('Equipment: Camera');
    if (values.cameraModel.trim())
      tags.push('Camera model: ' + values.cameraModel.trim());
  }
  if (values.device !== 'camera') {
    tags.push('Equipment: Phone');
    if (values.phoneModel.trim())
      tags.push('Phone model: ' + values.phoneModel.trim());
  }
  for (const tag of values.extraSkills
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)) {
    if (
      !managedTag(tag) &&
      !tags.some((value) => value.toLowerCase() === tag.toLowerCase())
    )
      tags.push(tag);
  }
  // The deployed backend caps skills at 20. Never silently drop selections or
  // existing extra skills when adding equipment information.
  if (tags.length > 20)
    throw new Error(
      'Please shorten the additional skills list (maximum 20 total entries).',
    );
  return tags;
}
