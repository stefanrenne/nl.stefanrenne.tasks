'use strict';

import FlowCardTrigger from 'homey/lib/FlowCardTrigger';
import Homey from 'homey/lib/Homey';
import {v4 as uuidv4} from 'uuid';

export interface Task {
    title: string;
    date: Date;
    identifier: string;
}

export class Store {

    private homey: Homey;
    private taskOnComplete: FlowCardTrigger | undefined;

	constructor(homey: Homey) {
        this.homey = homey;
        this.taskOnComplete = homey.flow.getTriggerCard('on_complete')
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

    add(title: string, identifier: string | undefined) {
        let newResult = this.get()
        if (identifier !== undefined) {
            newResult = newResult.filter((item) => item.identifier !== identifier);
        }
        newResult.push({title: title, date: new Date(), identifier: identifier ?? uuidv4()});
        this.set(newResult);
    }

    delete(identifier: string) {
        const result = this.get();
        const item = result.find((item) => item.identifier !== identifier);
        
        if (item !== undefined) {
            this.set(result.filter((item) => item.identifier !== identifier));
            this.taskOnComplete?.trigger({ title: item.title, identifier: item.identifier });
        }
    }
}