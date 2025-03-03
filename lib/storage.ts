'use strict';

import FlowCardTrigger from 'homey/lib/FlowCardTrigger';
import Homey from 'homey/lib/Homey';
import {v4 as uuidv4} from 'uuid';

export interface Task {
    title: string;
    date: Date;
    token: string;
}

export class Store {

    private homey: Homey;
    private taskOnCreate: FlowCardTrigger | undefined;
    private taskOnUpdate: FlowCardTrigger | undefined;
    private taskOnComplete: FlowCardTrigger | undefined;

	constructor(homey: Homey) {
        this.homey = homey;
        this.taskOnCreate = homey.flow.getTriggerCard('on_create');
        this.taskOnUpdate = homey.flow.getTriggerCard('on_update');
        this.taskOnComplete = homey.flow.getTriggerCard('on_complete');
    }

    get(): Task[] {
        const result = this.homey.settings.get('tasks') ?? [];
        console.log("=== GET ===");
        console.log(result);
        return result
      }
    
    set(tasks: Task[]) {
        console.log("=== SET ===");
        console.log(tasks);
        this.homey.settings.set('tasks', tasks);
        this.homey.api.realtime('didUpdateTasks', tasks);
    }

    add(title: string, token: string | undefined) {
        let newResult = this.get()
        const oldItem = newResult.find((item) => item.token == token);

        if (oldItem?.title === title) {
            // Existing task is not mutated
            return
        }

        if (token !== undefined && oldItem !== undefined) {
            newResult = newResult.filter((item) => item.token !== token);
            this.taskOnUpdate?.trigger({ oldTitle: oldItem.title, newTitle: title, token: token });
        } else {
            this.taskOnCreate?.trigger({ title: title, token: token });
        }
        newResult.push({title: title, date: new Date(), token: token ?? uuidv4()});
        this.set(newResult);
    }

    delete(token: string) {
        const result = this.get();
        const oldItem = result.find((item) => item.token == token);
        
        if (oldItem !== undefined) {
            const newResult = result.filter((item) => item.token !== token);
            this.set(newResult);
            this.taskOnComplete?.trigger({ title: oldItem.title, token: oldItem.token });
        }
    }
}