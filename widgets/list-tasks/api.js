'use strict';

import { Task, Store } from '../../lib/storage';

module.exports = {
  async getTasks({ homey, params }) {
    return homey.app.store.getTasks().sort((a, b) => new Date(b.date) - new Date(a.date))
  },

  async getFilteredTasks({ homey, params }) {
    return homey.app.store.getTasks().filter((item) => item.tag === params.tag).sort((a, b) => new Date(b.date) - new Date(a.date))
  },

  async deleteTask({ homey, params }) {
    homey.app.store.deleteTaskByIdentifier(params.id);
  },
};
