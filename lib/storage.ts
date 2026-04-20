'use strict';

import FlowCardTrigger from 'homey/lib/FlowCardTrigger';
import Homey from 'homey/lib/Homey';
import {v4 as uuidv4} from 'uuid';

export interface Task {
    title: string;
    date: Date;
    identifier: string;
    item: string | undefined;
    tag: string | undefined;
    locked: boolean;
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

    getTask(identifier: string, item: string | undefined): Task | undefined {
        return this.getTasks().find((task) => task.identifier === identifier && task.item === item);
    }

    getTasks(): Task[] {
        const result = this.homey.settings.get('tasks') ?? [];
        this.homey.log("=== GET ===");
        this.homey.log(result);
        return result
    }
    
    setTasks(tasks: Task[]) {
        this.homey.log("=== SET ===");
        this.homey.log(tasks);
        this.homey.settings.set('tasks', tasks);
        this.homey.api.realtime('didUpdateTasks', tasks);
    }

    addTask(title: string, identifier: string | undefined, item: string | undefined, tag: string | undefined = undefined) {
        const newIdentifier = identifier ?? uuidv4()
        let newResult = this.getTasks()
        const oldTask = newResult.find((task) => task.identifier === identifier && (!item || task.item === item));

        if (oldTask?.title === title) {
            // Existing task is not mutated
            return
        }

        if (oldTask !== undefined) {
            newResult = newResult.filter((task) => task.identifier !== newIdentifier || (item && task.item !== item));
            this.taskOnUpdate?.trigger({ oldTitle: oldTask.title, newTitle: title, identifier: newIdentifier, item: item ?? "" });
        } else {
            this.taskOnCreate?.trigger({ title: title, identifier: newIdentifier, item: item ?? "" });
        }
        newResult.push({title: title, date: new Date(), identifier: newIdentifier, item: item, tag: tag, locked: false});
        this.setTasks(newResult);
    }

    lockTaskByIdentifier(identifier: string, item: string | undefined = undefined) {
        let newResult = this.getTasks().map((task) => {
            if (task.identifier === identifier && (!item || task.item === item)) {
                task.locked = true
            }
            return task
        });
        this.setTasks(newResult);
    }

    unlockTaskByIdentifier(identifier: string, item: string | undefined = undefined) {
        let newResult = this.getTasks().map((task) => {
            if (task.identifier === identifier && (!item || task.item === item)) {
                task.locked = false
            }
            return task
        });
        this.setTasks(newResult);
    }

    deleteTaskByIdentifier(identifier: string, item: string | undefined = undefined) {
        const result = this.getTasks();
        const oldTask = result.find((task) => task.identifier === identifier && (!item || task.item === item));
        
        if (oldTask !== undefined) {
            const newResult = result.filter((task) => task.identifier !== identifier || (item && task.item !== item));
            this.setTasks(newResult);
            this.taskOnComplete?.trigger({ title: oldTask.title, identifier: oldTask.identifier, item: oldTask.item ?? "", tag: oldTask.tag ?? "" });
        }
    }

    deleteTaskByTag(tag: string) {
        const result = this.getTasks();
        const oldTasks = result.filter((task) => task.tag === tag);
        if (oldTasks.length > 0) {
            const newResult = result.filter((task) => task.tag !== tag);
            this.setTasks(newResult);
            oldTasks.forEach((oldTask) => {
                this.taskOnComplete?.trigger({ title: oldTask.title, identifier: oldTask.identifier, item: oldTask.item ?? "", tag: oldTask.tag ?? "" });
            });
        }
    }

    setTag(tag: string | undefined, identifier: string, item: string | undefined) {
        let newResult = this.getTasks().map((task) => {
            if (task.identifier === identifier && (!item || task.item === item)) {
                task.tag = tag
            }
            return task
        });
        this.setTasks(newResult);
    }
}