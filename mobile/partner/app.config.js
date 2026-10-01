// Link an existing EAS project through build configuration; never invent an ID.
module.exports = ({ config }) => {
  const projectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() ||
    config.extra?.eas?.projectId;
  if (
    projectId &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      projectId,
    )
  ) {
    throw new Error(
      'EXPO_PUBLIC_EAS_PROJECT_ID must be the UUID of your existing Expo/EAS project.',
    );
  }
  return {
    ...config,
    ...(projectId
      ? { extra: { ...config.extra, eas: { ...config.extra?.eas, projectId } } }
      : {}),
  };
};
