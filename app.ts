'use strict';

import Homey from 'homey';
import {v4 as uuidv4} from 'uuid';
import { Task, Store } from './lib/storage';

module.exports = class MyApp extends Homey.App {

  private allTokens = new Set<string>();
  private store = new Store(this.homey);

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    await this.updateAllTokens();
    this.registerOpenTaskListeners();
    this.registerCreateTaskListeners();
    this.registerCompleteTaskListeners();
    this.registerCompleteAllTasksListeners();
  }

  async getAllCards(): Promise<(Homey.FlowCardAction | Homey.FlowCardTrigger | Homey.FlowCardCondition)[]> {
    let allCards: (Homey.FlowCardAction | Homey.FlowCardTrigger | Homey.FlowCardCondition)[] = [];
    for (const flowTypeId in this.homey.manifest.flow) {
      if (Object.hasOwnProperty.call(this.homey.manifest.flow, flowTypeId)) {
				const flowType = this.homey.manifest.flow[flowTypeId];
				for (const flowcard of flowType) {
          if (flowcard.args && flowcard.args.some((flow: any) => flow.name == 'token')) {
            switch (flowTypeId) {
              case "actions":
                allCards.push(this.homey.flow.getActionCard(flowcard.id))
                break;
              case "triggers":
                allCards.push(this.homey.flow.getTriggerCard(flowcard.id))
                break;
              case "conditions":
                allCards.push(this.homey.flow.getConditionCard(flowcard.id))
                break;
              default:
                break;
            }
          }
        }
      }
    }
    return allCards
  }

  async updateAllTokens() {
    const allCards = await this.getAllCards()
    const uniqueTokens = await allCards.reduce(
      async (resultPromise, card) => {
        let result = await resultPromise;
        let args = await card.getArgumentValues();
        args.filter(x => x.token).map(x => x.token.name).forEach(token => {
          result.add(token);
        })
        return result;
    }, Promise.resolve(new Set<string>()));
    this.allTokens = uniqueTokens
  }

  /** Helpers */
  registerAutocompleteListenerForCard(card: Homey.FlowCardAction | Homey.FlowCardTrigger | Homey.FlowCardCondition, canRegisterNewToken: boolean) {
    card.registerArgumentAutocompleteListener('token', async (query: string, args: any) => {
      let results = Array.from(this.allTokens)
      .filter((result) => {
        return query.length == 0 || result.toLowerCase().includes(query.toLowerCase());
      })
      .sort()
      .map(token => {
        return {
          name: token,
          description: ''
        }
      });

      if (canRegisterNewToken && query && query.length > 0 && !(results.length == 1 && results[0].name.toLowerCase() == query.toLowerCase())) {
        results.unshift({
          name: query,
          description: this.homey.__('newToken')
        });
      }
      return results;
    });

    card.on('update', async () => {
      await this.updateAllTokens();
    });
  }

  /** TaskListeners */
  registerOpenTaskListeners() {
    const card = this.homey.flow.getConditionCard('open_task')
    this.registerAutocompleteListenerForCard(card, false)
    card.registerRunListener((args) => {
      const token: string = args.token.name;
      return this.store.get().some((element) => element.token === token);
    });
  }

  registerCreateTaskListeners() {
    const card = this.homey.flow.getActionCard('create_task')
    this.registerAutocompleteListenerForCard(card, true)
    card.registerRunListener((args) => {
      const title: string = args.title;
      const token: string | undefined = (args.token) ? args.token.name : undefined;
      this.store.add(title, token);
      return {
        title
      };
    });
  }

  registerCompleteTaskListeners() {
    const card = this.homey.flow.getActionCard('complete_task')
    this.registerAutocompleteListenerForCard(card, false)
    card.registerRunListener((args) => {
      const token: string = args.token.name;
      this.store.delete(token);
      return {};
    });
  }

  registerCompleteAllTasksListeners() {
    const card = this.homey.flow.getActionCard('complete_all')
    card.registerRunListener((args) => {
      this.store.set([]);
      return {};
    });
  }
}
