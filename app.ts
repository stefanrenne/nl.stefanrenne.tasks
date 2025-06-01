'use strict';

import Homey from 'homey';
import {v4 as uuidv4} from 'uuid';
import { Task, Store } from './lib/storage';

module.exports = class MyApp extends Homey.App {

  private allIdentifiers = new Set<string>();
  private allTags = new Set<string>();
  private store = new Store(this.homey);

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    await this.updateAllIdentifiers();
    await this.updateAllTags();
    this.registerTagTaskListeners();
    this.registerUntagTaskListener();
    this.registerOpenTaskListeners();
    this.registerCreateTaskListeners();
    this.registerCompleteTaskListeners();
    this.registerCompleteMarkedTasksListeners();
    this.registerCompleteAllTasksListeners();
    this.registerGetAllTasksListeners();
    this.registerWidgetListeners();
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

  async updateAllTags() {
    const allCards = await this.getAllCards();

    const uniqueTags = await allCards.reduce(
      async (resultPromise, card) => {
        let result = await resultPromise;
        let args = await card.getArgumentValues();
        args.filter(x => x.tag).map(x => x.tag.name).forEach(tag => {
          result.add(tag);
        })
        return result;
    }, Promise.resolve(new Set<string>()));

    this.store.getTasks().map(x => x.tag).filter((tag) => tag !== undefined).forEach(tag => {
      uniqueTags.add(tag);
    });
    this.allTags = uniqueTags
  }

  /** Helpers */
  registerIdentifierAutocompleteListenerForCard(card: Homey.FlowCardAction | Homey.FlowCardTrigger | Homey.FlowCardCondition, canRegisterNewIdentifier: boolean) {
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

  registerTagAutocompleteListenerForCard(card: Homey.FlowCardAction | Homey.FlowCardTrigger | Homey.FlowCardCondition, canRegisterNewTag: boolean) {
    card.registerArgumentAutocompleteListener('tag', async (query: string, args: any) => {
      let results = Array.from(this.allTags)
      .filter((result) => {
        return query.length == 0 || result.toLowerCase().includes(query.toLowerCase());
      })
      .sort()
      .map(tag => {
        return {
          name: tag,
          description: ''
        }
      });

      if (canRegisterNewTag && query && query.length > 0 && !(results.length == 1 && results[0].name.toLowerCase() == query.toLowerCase())) {
        results.unshift({
          name: query,
          description: this.homey.__('newTag')
        });
      }
      return results;
    });

    card.on('update', async () => {
      await this.updateAllTags();
    });
  }

  /** TaskListeners */
  registerOpenTaskListeners() {
    const card = this.homey.flow.getConditionCard('open_task')
    this.registerIdentifierAutocompleteListenerForCard(card, false)
    card.registerRunListener((args) => {
      const identifier: string = args.identifier.name;
      return this.store.getTasks().some((element) => element.identifier === identifier);
    });
  }

  registerCreateTaskListeners() {
    const card = this.homey.flow.getActionCard('create_task')
    this.registerIdentifierAutocompleteListenerForCard(card, true)
    card.registerRunListener((args) => {
      const title: string = args.title;
      const identifier: string | undefined = (args.identifier) ? args.identifier.name : undefined;
      this.store.addTask(title, identifier);
      return {
        title
      };
    });
  }

  registerCompleteTaskListeners() {
    const card = this.homey.flow.getActionCard('complete_task')
    this.registerIdentifierAutocompleteListenerForCard(card, false)
    card.registerRunListener((args) => {
      const identifier: string = args.identifier.name;
      this.store.deleteTaskByIdentifier(identifier);
      return {};
    });
  }

  registerCompleteMarkedTasksListeners() {
    const card = this.homey.flow.getActionCard('complete_tag')
    this.registerTagAutocompleteListenerForCard(card, false)
    card.registerRunListener((args) => {
      const tag: string = args.tag.name;
      this.store.deleteTaskByTag(tag);
      return {};
    });
  }

  registerCompleteAllTasksListeners() {
    const card = this.homey.flow.getActionCard('complete_all')
    card.registerRunListener((args) => {
      this.store.setTasks([]);
      return {};
    });
  }

  registerGetAllTasksListeners() {
    const card = this.homey.flow.getActionCard('get_all')
    card.registerRunListener((args) => {
      const tasks = this.store.getTasks().map((element) => ({ title: element.title, date: element.date }));
      const count = tasks.length;
      const json = JSON.stringify(tasks)
      return {
        json,
        count
      };
    });
  }

  registerTagTaskListeners() {
    const card = this.homey.flow.getActionCard('tag_task')
    this.registerIdentifierAutocompleteListenerForCard(card, false);
    this.registerTagAutocompleteListenerForCard(card, true);
    card.registerRunListener((args) => {
      this.store.setTag(args.tag.name, args.identifier.name);
      return {};
    });
  }

  registerUntagTaskListener() {
    const card = this.homey.flow.getActionCard('untag_task')
    this.registerIdentifierAutocompleteListenerForCard(card, false);
    card.registerRunListener((args) => {
      this.store.setTag(undefined, args.identifier.name);
      return {};
    });
  }

  registerWidgetListeners() {
    const widget = this.homey.dashboards.getWidget('list-tasks');
    
    widget.registerSettingAutocompleteListener('tag', async (query: string, settings: any) => {
      let results = Array.from(this.allTags)
      .filter((result) => {
        return query.length == 0 || result.toLowerCase().includes(query.toLowerCase());
      })
      .sort()
      .map(tag => {
        return {
          name: tag
        }
      });

      if (query.length === 0 ) {
        results.unshift({
          name: '-'
        });
      }
      return results;
    });
  }
}
