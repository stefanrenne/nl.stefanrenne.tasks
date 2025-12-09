'use strict';

import { Task, Store } from './lib/storage';

module.exports = {
  async getTasks({ homey, query }) {
    return homey.app.store.getTasks().sort((a, b) => new Date(b.date) - new Date(a.date))
  },

  async createTask({ homey, body }) {
    homey.app.store.addTask(body.title, body.identifier, body.item);
  },

  async deleteTask({ homey, params }) {
    homey.app.store.deleteTaskByIdentifier(params.id);
  },

  async deleteTaskItem({ homey, params }) {
    homey.app.store.deleteTaskByIdentifier(params.id, params.item);
  },

  async getIdentifiers({ homey, query }) {
    await homey.app.updateAllIdentifiers();
    return Array.from(homey.app.allIdentifiers);
  },

};
