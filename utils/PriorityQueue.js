export class PriorityQueue {
  constructor(comparator = (a, b) => a - b) {
    this.heap = [];
    this.comparator = comparator;
  }

  enqueue(value) {
    this.heap.push(value);
    this.bubbleUp();
  }

  dequeue() {
    const root = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.sinkDown();
    }
    return root;
  }

  size() {
    return this.heap.length;
  }

  bubbleUp() {
    let index = this.heap.length - 1;
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.comparator(this.heap[index], this.heap[parentIndex]) >= 0) break;
      [this.heap[parentIndex], this.heap[index]] = [this.heap[index], this.heap[parentIndex]];
      index = parentIndex;
    }
  }

  sinkDown() {
    let index = 0;
    const length = this.heap.length;
    
    while (true) {
      const leftChildIndex = 2 * index + 1;
      const rightChildIndex = 2 * index + 2;
      let swapIndex = null;

      if (leftChildIndex < length) {
        if (this.comparator(this.heap[leftChildIndex], this.heap[index]) < 0) {
          swapIndex = leftChildIndex;
        }
      }

      if (rightChildIndex < length) {
        if (
          (swapIndex === null && this.comparator(this.heap[rightChildIndex], this.heap[index]) < 0) ||
          (swapIndex !== null && this.comparator(this.heap[rightChildIndex], this.heap[leftChildIndex]) < 0)
        ) {
          swapIndex = rightChildIndex;
        }
      }

      if (swapIndex === null) break;
      [this.heap[index], this.heap[swapIndex]] = [this.heap[swapIndex], this.heap[index]];
      index = swapIndex;
    }
  }
} 