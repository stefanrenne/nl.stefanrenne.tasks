'use strict';

module.exports = {
  async getTasks({ homey, query }) {
    // you can access query parameters like "/?foo=bar" through `query.foo`

    // you can access the App instance through homey.app
    // const result = await homey.app.getSomething();
    // return result;

    // perform other logic like mapping result data

    return 'Hello from App';
  },

  async deleteTask({ homey, params }) {
    return homey.app.deleteSomething(params.id);
  },
};
