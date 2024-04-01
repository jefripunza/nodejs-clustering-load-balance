module.exports = [
  {
    endpoint: "/product/:product_id",
    method: "POST",
    script: `
console.log("Start...");

return {
  done: true,
  req,
}`,
  },
];


/**
excel OK!
csv OK!
pdf OTHER SERVICE, use Browser!
word
txt
 */