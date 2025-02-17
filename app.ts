'use strict';

import Homey from 'homey';

module.exports = class MyApp extends Homey.App {

  allIdentifiers = new Set<string>();

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    await this.updateAllIdentifiers();
    this.registerCreateTaskListeners();
    this.registerDeleteTaskListeners();
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
              // case "triggers":
              //   allCards.push(this.homey.flow.getTriggerCard(flowcard.id))
              // case "conditions":
              //   allCards.push(this.homey.flow.getConditionCard(flowcard.id))
              default:
                break
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
          description: 'Create new Identifier'
        });
      }
      return results;
    });

    card.on('update', async () => {
      await this.updateAllIdentifiers();
    });
  }

  /** TaskListeners */
  registerCreateTaskListeners() {
    const card = this.homey.flow.getActionCard('create_task')
    this.registerAutocompleteListenerForCard(card, true)
    card.registerRunListener((args) => {
      const title: string = args.title;
      const identifier: string | undefined = (args.identifier) ? args.identifier.name : undefined;
      this.store(title, identifier);
      return {
        title
      };
    });
  }

  registerDeleteTaskListeners() {
    const card = this.homey.flow.getActionCard('delete_task')
    this.registerAutocompleteListenerForCard(card, false)
    card.registerRunListener((args) => {
      const identifier: string = args.identifier.name;
      this.delete(identifier);
      return {};
    });
  }

  /** Storage */
  fetch(): {title: string; date: number; identifier: string | undefined;}[] {
    const result: {title: string; date: number; identifier: string | undefined;}[] = this.homey.settings.get('tasks') ?? [];
    return result;
  }

  store(title: string, identifier: string | undefined) {
    let newResult = this.fetch()
    if (identifier !== undefined) {
      newResult = newResult.filter((item) => item.identifier !== identifier);
    }
    newResult.push({title: title, date: new Date().getTime(), identifier: identifier});
    this.homey.settings.set('tasks', newResult);
  }

  delete(identifier: string) {
    let newResult = this.fetch().filter((item) => item.identifier !== identifier);
    this.homey.settings.set('tasks', newResult);
  }
}
