'use strict';

import { Task, Store } from './lib/storage';

module.exports = {
  async getTasks({ homey }) {
    return homey.app.store.getTasks().sort((a, b) => new Date(b.date) - new Date(a.date))
  },

  async deleteTask({ homey, params }) {
    homey.app.store.deleteTaskByIdentifier(params.id);
  },

  async deleteTaskItem({ homey, params }) {
    homey.app.store.deleteTaskByIdentifier(params.id, params.item);
  },
};
