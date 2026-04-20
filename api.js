'use strict';

module.exports = {
  async getTasks({ homey, query }) {
    return homey.app.store.getTasks().sort((a, b) => new Date(b.date) - new Date(a.date))
  },

  async createTask({ homey, body }) {
    homey.app.store.addTask(body.title, body.identifier, body.item, body.tag);
  },

  async deleteTask({ homey, params }) {
    homey.app.store.deleteTaskByIdentifier(params.id);
  },

  async deleteTaskItem({ homey, params }) {
    homey.app.store.deleteTaskByIdentifier(params.id, params.item);
  },

  async lockTask({ homey, body, params }) {
    homey.app.store.lockTaskByIdentifier(params.id);
  },

  async lockTaskItem({ homey, body, params }) {
    homey.app.store.lockTaskByIdentifier(params.id, params.item);
  },

  async unlockTask({ homey, body, params }) {
    homey.app.store.unlockTaskByIdentifier(params.id);
  },

  async unlockTaskItem({ homey, body, params }) {
    homey.app.store.unlockTaskByIdentifier(params.id, params.item);
  },

  async getIdentifiers({ homey, query }) {
    await homey.app.updateAllIdentifiers();
    return Array.from(homey.app.allIdentifiers);
  },

  async getTags({ homey, query }) {
    await homey.app.updateAllTags();
    return Array.from(homey.app.allTags);
  },

};
