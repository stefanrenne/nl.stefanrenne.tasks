'use strict';

import Homey from 'homey';
import {v4 as uuidv4} from 'uuid';
import { Task, Store } from './lib/storage';

module.exports = class MyApp extends Homey.App {

  private allIdentifiers = new Set<string>();
  private store = new Store(this.homey);

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    await this.updateAllIdentifiers();
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
          if (flowcard.args && flowcard.args.some((flow: any) => flow.name == 'identifier')) {
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

  async updateAllIdentifiers() {
    const allCards = await this.getAllCards()
    const uniqueIdentifiers = await allCards.reduce(
      async (resultPromise, card) => {
        let result = await resultPromise;
        let args = await card.getArgumentValues();
        args.filter(x => x.identifier).map(x => x.identifier.name).forEach(identifier => {
          result.add(identifier);
        })
        return result;
    }, Promise.resolve(new Set<string>()));
    this.allIdentifiers = uniqueIdentifiers
  }

  /** Helpers */
  registerAutocompleteListenerForCard(card: Homey.FlowCardAction | Homey.FlowCardTrigger | Homey.FlowCardCondition, canRegisterNewIdentifier: boolean) {
    card.registerArgumentAutocompleteListener('identifier', async (query: string, args: any) => {
      let results = Array.from(this.allIdentifiers)
      .filter((result) => {
        return query.length == 0 || result.toLowerCase().includes(query.toLowerCase());
      })
      .sort()
      .map(identifier => {
        return {
          name: identifier,
          description: ''
        }
      });

      if (canRegisterNewIdentifier && query && query.length > 0 && !(results.length == 1 && results[0].name.toLowerCase() == query.toLowerCase())) {
        results.unshift({
          name: query,
          description: this.homey.__('newIdentifier')
        });
      }
      return results;
    });

    card.on('update', async () => {
      await this.updateAllIdentifiers();
    });
  }

  /** TaskListeners */
  registerOpenTaskListeners() {
    const card = this.homey.flow.getConditionCard('open_task')
    this.registerAutocompleteListenerForCard(card, false)
    card.registerRunListener((args) => {
      const identifier: string = args.identifier.name;
      return this.store.get().some((element) => element.identifier === identifier);
    });
  }

  registerCreateTaskListeners() {
    const card = this.homey.flow.getActionCard('create_task')
    this.registerAutocompleteListenerForCard(card, true)
    card.registerRunListener((args) => {
      const title: string = args.title;
      const identifier: string | undefined = (args.identifier) ? args.identifier.name : undefined;
      this.store.add(title, identifier);
      return {
        title
      };
    });
  }

  registerCompleteTaskListeners() {
    const card = this.homey.flow.getActionCard('complete_task')
    this.registerAutocompleteListenerForCard(card, false)
    card.registerRunListener((args) => {
      const identifier: string = args.identifier.name;
      this.store.delete(identifier);
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
