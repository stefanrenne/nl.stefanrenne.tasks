'use strict';

import Homey from 'homey/lib/Homey';

export interface Task {
    title: string;
    date: Date;
    identifier: string;
}