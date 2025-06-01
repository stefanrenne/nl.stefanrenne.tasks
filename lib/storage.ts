'use strict';

import FlowCardTrigger from 'homey/lib/FlowCardTrigger';
import Homey from 'homey/lib/Homey';
import {v4 as uuidv4} from 'uuid';

export interface Task {
    title: string;
    date: Date;
    identifier: string;
    tag: string | undefined;
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

    getTask(identifier: string): Task | undefined {
        return this.getTasks().find((item) => item.identifier === identifier);
    }

    getTasks(): Task[] {
        const result = this.homey.settings.get('tasks') ?? [];
        console.log("=== GET ===");
        console.log(result);
        return result
    }
    
    setTasks(tasks: Task[]) {
        console.log("=== SET ===");
        console.log(tasks);
        this.homey.settings.set('tasks', tasks);
        this.homey.api.realtime('didUpdateTasks', tasks);
    }

    addTask(title: string, identifier: string | undefined, tag: string | undefined = undefined) {
        const newIdentifier = identifier ?? uuidv4()
        let newResult = this.getTasks()
        const oldItem = newResult.find((item) => item.identifier === newIdentifier);

        if (oldItem?.title === title) {
            // Existing task is not mutated
            return
        }

        if (oldItem !== undefined) {
            newResult = newResult.filter((item) => item.identifier !== newIdentifier);
            this.taskOnUpdate?.trigger({ oldTitle: oldItem.title, newTitle: title, identifier: newIdentifier });
        } else {
            this.taskOnCreate?.trigger({ title: title, identifier: newIdentifier });
        }
        newResult.push({title: title, date: new Date(), identifier: newIdentifier, tag: tag});
        this.setTasks(newResult);
    }

    deleteTaskByIdentifier(identifier: string) {
        const result = this.getTasks();
        const oldItem = result.find((item) => item.identifier === identifier);
        
        if (oldItem !== undefined) {
            const newResult = result.filter((item) => item.identifier !== identifier);
            this.setTasks(newResult);
            this.taskOnComplete?.trigger({ title: oldItem.title, identifier: oldItem.identifier, tag: oldItem.tag ?? "" });
        }
    }

    deleteTaskByTag(tag: string) {
        const result = this.getTasks();
        const oldItems = result.filter((item) => item.tag === tag);
        if (oldItems.length > 0) {
            const newResult = result.filter((item) => item.tag !== tag);
            this.setTasks(newResult);
            oldItems.forEach((oldItem) => {
                this.taskOnComplete?.trigger({ title: oldItem.title, identifier: oldItem.identifier, tag: oldItem.tag ?? "" });
            });
        }
    }

    setTag(tag: string | undefined, identifier: string) {
        let newResult = this.getTasks().map((item) => {
            if (item.identifier === identifier) {
                item.tag = tag
            }
            return item
        });
        this.setTasks(newResult);        
    }
}