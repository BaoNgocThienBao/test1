const express = require('express');
const Web3 = require('web3');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const contractABI = require('./ProductVerification.json'); // ABI from compiled contract

// Configuration
const app = express();
const port = process.env.PORT || 3000;
const contractAddress = process.env.CONTRACT_ADDRESS;
const web3 = new Web3(process.env.BLOCKCHAIN_PROVIDER || 'http://localhost:8545');

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Initialize contract
const productContract = new web3.eth.Contract(contractABI, contractAddress);

// Helper function to get account
async function getAccount() {
  const accounts = await web3.eth.getAccounts();
  return accounts[0];
}

// Routes
app.post('/api/product/register', async (req, res) => {
  try {
    const { productName, manufacturer, manufacturingDate, batchNumber } = req.body;
    
    // Generate unique product ID
    const productId = uuidv4();
    const account = await getAccount();
    
    // Call smart contract
    const result = await productContract.methods.registerProduct(
      productId,
      productName,
      manufacturer,
      manufacturingDate,
      batchNumber
    ).send({ from: account, gas: 500000 });
    
    res.status(200).json({
      success: true,
      productId,
      transactionHash: result.transactionHash
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

app.post('/api/product/transfer', async (req, res) => {
  try {
    const { productId, recipientAddress, location, additionalInfo } = req.body;
    const account = await getAccount();
    
    const result = await productContract.methods.transferProduct(
      productId,
      recipientAddress,
      location,
      additionalInfo
    ).send({ from: account, gas: 300000 });
    
    res.status(200).json({
      success: true,
      transactionHash: result.transactionHash
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

app.get('/api/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    
    // Get basic product details
    const productDetails = await productContract.methods.getProductDetails(productId).call();
    
    // Get transfer history
    const transferCount = await productContract.methods.getTransferCount(productId).call();
    const transferHistory = [];
    
    for (let i = 0; i < transferCount; i++) {
      const transfer = await productContract.methods.getTransferDetails(productId, i).call();
      transferHistory.push({
        from: transfer[0],
        to: transfer[1],
        timestamp: new Date(transfer[2] * 1000).toISOString(),
        location: transfer[3],
        additionalInfo: transfer[4]
      });
    }
    
    res.status(200).json({
      success: true,
      product: {
        productId: productDetails[0],
        productName: productDetails[1],
        manufacturer: productDetails[2],
        manufacturingDate: productDetails[3],
        batchNumber: productDetails[4],
        registeredBy: productDetails[5],
        registrationTimestamp: new Date(productDetails[6] * 1000).toISOString(),
        isActive: productDetails[7],
        currentOwner: productDetails[8],
        transferHistory
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

app.get('/api/product/verify/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    
    const verification = await productContract.methods.verifyProduct(productId).call();
    
    res.status(200).json({
      success: true,
      isAuthentic: verification[0],
      currentOwner: verification[1]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

app.post('/api/manufacturer/authorize', async (req, res) => {
  try {
    const { manufacturerAddress } = req.body;
    const account = await getAccount();
    
    const result = await productContract.methods.authorizeManufacturer(
      manufacturerAddress
    ).send({ from: account, gas: 100000 });
    
    res.status(200).json({
      success: true,
      transactionHash: result.transactionHash
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Anti-counterfeit API listening at http://localhost:${port}`);
});

module.exports = app;
