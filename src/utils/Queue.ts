/**
 * Queue data structure for managing file uploads
 * Implements FIFO (First In, First Out) ordering
 */
class Queue<T> {
  private elements: Record<number, T> = {};
  private head: number = 0;
  private tail: number = 0;

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
}

export default Queue;
