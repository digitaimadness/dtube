/* Disable verbose logging in production */
if (process.env.NODE_ENV === 'production') {
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
}

// ... existing code ... 