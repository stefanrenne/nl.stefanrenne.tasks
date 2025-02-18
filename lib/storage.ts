'use strict';

import Homey from 'homey/lib/Homey';
import {v4 as uuidv4} from 'uuid';

export interface Task {
    title: string;
    date: Date;
    identifier: string;
}

export class Store {

    homey: Homey;
	constructor(homey: Homey) {
        this.homey = homey;
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
        let newResult = this.get().filter((item) => item.identifier !== identifier);
        this.set(newResult);
    }
}