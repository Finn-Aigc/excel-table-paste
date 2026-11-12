export const mockState = {
  commands: [] as Array<{
    id: string;
    editorCallback: (editor: unknown) => unknown;
  }>,
  notices: [] as string[],
};

export class Plugin {
  app: unknown;
  constructor(app: unknown) {
    this.app = app;
  }
  registerEvent() {}
  addCommand(command: (typeof mockState.commands)[number]) {
    mockState.commands.push(command);
  }
  addSettingTab() {}
  async loadData() {
    return null;
  }
  async saveData() {}
}

export class PluginSettingTab {}

export class Setting {}

export class Notice {
  constructor(message: string) {
    mockState.notices.push(message);
  }
}