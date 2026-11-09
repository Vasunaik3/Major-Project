# Future ML service interface (documentation only)

No model, image processing, or inference code is implemented. Integration is deferred until an onion image dataset is collected and a model is trained.

## Planned contract

- Input: an image upload or an image reference, plus an optional request ID.
- Output: `status`, `prediction`, `confidence`, optional `features`, `modelVersion`, and `createdAt`.
- Until a model is available, the Node.js API should return a clearly marked unavailable status and the message: “AI analysis will be enabled after dataset collection and model training.”

## Intended pipeline

Camera/image → OpenCV preprocessing → feature extraction → trained Random Forest model → prediction response → Node.js API → MongoDB → React dashboard.

This contract is provisional; it does not imply that AI-based onion detection currently exists.
