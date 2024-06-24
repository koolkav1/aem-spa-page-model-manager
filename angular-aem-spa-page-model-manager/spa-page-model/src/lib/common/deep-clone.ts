// Utility function for deep cloning objects
export function deepClone(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => deepClone(item));
    }

    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }

    if (obj instanceof Object) {
        // Define the copy object with an index signature to allow any string as a key
        const copy: { [key: string]: any } = {};
        Object.keys(obj).forEach(key => {
            copy[key] = deepClone(obj[key]);
        });
        return copy;
    }

    throw new Error('Unable to copy obj! Its type isn\'t supported.');
}
