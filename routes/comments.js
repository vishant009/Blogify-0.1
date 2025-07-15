const { Router } = require("express");
const Comment = require("../models/comments");

const router = Router();

// POST /comment/:blogId
router.post("/:blogId", async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect(`/blog/${req.params.blogId}?error_msg=Please log in to add a comment`);
    }
    await Comment.create({
      content: req.body.content,
      blogId: req.params.blogId,
      createdBy: req.user._id,
      likes: [],
    });
    return res.redirect(`/blog/${req.params.blogId}?success_msg=Comment added successfully`);
  } catch (err) {
    console.error("Error adding comment:", err);
    return res.redirect(`/blog/${req.params.blogId}?error_msg=Failed to add comment`);
  }
});

// DELETE /comment/:commentId
router.delete("/:commentId", async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) {
      return res.redirect(`/blog/${req.query.blogId || ''}?error_msg=Comment not found`);
    }
    if (!req.user || comment.createdBy.toString() !== req.user._id.toString()) {
      return res.redirect(`/blog/${comment.blogId}?error_msg=Unauthorized to delete this comment`);
    }
    await Comment.findByIdAndDelete(req.params.commentId);
    return res.redirect(`/blog/${comment.blogId}?success_msg=Comment deleted successfully`);
  } catch (err) {
    console.error("Error deleting comment:", err);
    return res.redirect(`/blog/${req.query.blogId || ''}?error_msg=Failed to delete comment`);
  }
});

// POST /comment/:commentId/like
router.post("/:commentId/like", async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect(`/blog/${req.query.blogId || ''}?error_msg=Please log in to like a comment`);
    }
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) {
      return res.redirect(`/blog/${req.query.blogId || ''}?error_msg=Comment not found`);
    }
    if (comment.likes.includes(req.user._id)) {
      return res.redirect(`/blog/${comment.blogId}?error_msg=You have already liked this comment`);
    }
    comment.likes.push(req.user._id);
    await comment.save();
    return res.redirect(`/blog/${comment.blogId}?success_msg=Comment liked successfully`);
  } catch (err) {
    console.error("Error liking comment:", err);
    return res.redirect(`/blog/${req.query.blogId || ''}?error_msg=Failed to like comment`);
  }
});

// DELETE /comment/:commentId/like
router.delete("/:commentId/like", async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect(`/blog/${req.query.blogId || ''}?error_msg=Please log in to unlike a comment`);
    }
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) {
      return res.redirect(`/blog/${req.query.blogId || ''}?error_msg=Comment not found`);
    }
    if (!comment.likes.includes(req.user._id)) {
      return res.redirect(`/blog/${comment.blogId}?error_msg=You have not liked this comment`);
    }
    comment.likes = comment.likes.filter((userId) => userId.toString() !== req.user._id.toString());
    await comment.save();
    return res.redirect(`/blog/${comment.blogId}?success_msg=Comment unliked successfully`);
  } catch (err) {
    console.error("Error unliking comment:", err);
    return res.redirect(`/blog/${req.query.blogId || ''}?error_msg=Failed to unlike comment`);
  }
});

module.exports = router;