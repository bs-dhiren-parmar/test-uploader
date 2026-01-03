/**
 * Queue data structure for managing file uploads
 * Implements FIFO (First In, First Out) ordering
 */
class Queue<T> {
    private elements: Record<number, T> = {};
    private head = 0;
    private tail = 0;

    /**
     * Add an element to the end of the queue
     */
    enqueue(element: T): void {
        this.elements[this.tail] = element;
        this.tail++;
    }

    /**
     * Remove and return the first element from the queue
     */
    dequeue(): T | undefined {
        if (this.isEmpty) {
            return undefined;
        }
        const item = this.elements[this.head];
        delete this.elements[this.head];
        this.head++;
        return item;
    }

    /**
     * Return the first element without removing it
     */
    peek(): T | undefined {
        return this.elements[this.head];
    }

    /**
     * Get the number of elements in the queue
     */
    get length(): number {
        return this.tail - this.head;
    }

    /**
     * Check if the queue is empty
     */
    get isEmpty(): boolean {
        return this.length === 0;
    }

    /**
     * Clear all elements from the queue
     */
    clear(): void {
        this.elements = {};
        this.head = 0;
        this.tail = 0;
    }

    /**
     * Get all elements as an array
     */
    toArray(): T[] {
        const result: T[] = [];
        for (let i = this.head; i < this.tail; i++) {
            result.push(this.elements[i]);
        }
        return result;
    }

    /**
     * Remove elements that match the predicate
     * Returns the number of elements removed
     */
    removeBy(predicate: (element: T) => boolean): number {
        let removedCount = 0;
        const newElements: Record<number, T> = {};
        let newIndex = 0;

        for (let i = this.head; i < this.tail; i++) {
            const element = this.elements[i];
            if (!predicate(element)) {
                newElements[newIndex] = element;
                newIndex++;
            } else {
                removedCount++;
            }
        }

        this.elements = newElements;
        this.head = 0;
        this.tail = newIndex;
        return removedCount;
    }
}

export default Queue;
