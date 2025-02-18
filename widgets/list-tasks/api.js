'use strict';

import { Task, Store } from '../../lib/storage';

module.exports = {
  async getTasks({ homey, query }) {
    return homey.app.store.get().sort((a, b) => new Date(b.date) - new Date(a.date))
  },

  async deleteTask({ homey, params }) {
    homey.app.store.delete(params.id);
  },
};
