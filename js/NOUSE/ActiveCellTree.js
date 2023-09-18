/**
 * http://www.java2s.com/Tutorials/Javascript/Javascript_Data_Structure/0420__Javascript_Binary_Tree.htm
 *
 *
 *
 */
define(["dojo/_base/declare"], function (declare) {

  function Node(data, left, right) {
    this.data = data;
    this.left = left;
    this.right = right;
    this.show = () => {
      return this.data;
    };
  }

  const ActiveCellTree = declare(null, {

    root: null,

    constructor: function () {
      this.root = null;
    },

    insert: function (data) {
      const n = new Node(data, null, null);
      if(this.root == null) {
        this.root = n;
      } else {
        let current = this.root;
        let parent;
        while (true) {
          parent = current;
          if(data < current.data) {
            current = current.left;
            if(current == null) {
              parent.left = n;
              break;
            }
          } else {
            current = current.right;
            if(current == null) {
              parent.right = n;
              break;
            }
          }
        }
      }
    },

    inOrder: function (node) {
      if(!(node == null)) {
        this.inOrder(node.left);
        console.log(node.show() + " ");
        this.inOrder(node.right);
      }
    },

    preOrder: function (node) {
      if(!(node == null)) {
        console.log(node.show() + " ");
        this.preOrder(node.left);
        this.preOrder(node.right);
      }
    },

    postOrder: function (node) {
      if(!(node == null)) {
        this.postOrder(node.left);
        this.postOrder(node.right);
        console.log(node.show() + " ");
      }
    },

    getMin: function () {
      let current = this.root;
      while (!(current.left == null)) {
        current = current.left;
      }
      return current.data;
    },

    getMax: function () {
      let current = this.root;
      while (!(current.right == null)) {
        current = current.right;
      }
      return current.data;
    },

    find: function (data) {
      let current = this.root;
      while (current.data != data) {
        if(data < current.data) {
          current = current.left;
        } else {
          current = current.right;
        }
        if(current == null) {
          return null;
        }
      }
      return current;
    },

    remove: function (data) {
      this.root = this.removeNode(this.root, data);
    },

    removeNode: function (node, data) {
      if(node == null) {
        return null;
      }
      if(data == node.data) {
        // node has no children
        if(node.left == null && node.right == null) {
          return null;
        }
        // node has no left child
        if(node.left == null) {
          return node.right;
        }
        // node has no right child
        if(node.right == null) {
          return node.left;
        }
        // node has two children
        const tempNode = getSmallest(node.right);
        node.data = tempNode.data;
        node.right = this.removeNode(node.right, tempNode.data);
        return node;
      } else if(data < node.data) {
        node.left = this.removeNode(node.left, data);
        return node;
      } else {
        node.right = this.removeNode(node.right, data);
        return node;
      }
    }

  });

  ActiveCellTree.version = "0.0.1";

  return ActiveCellTree;
});