export interface AppInfo {
  name: string;
  displayName: string;
}

/** Sample shared function, imported by both the API and the web app to prove the wiring works. */
export function getAppInfo(): AppInfo {
  return {
    name: 'gold-tracker',
    displayName: 'G-management',
  };
}
