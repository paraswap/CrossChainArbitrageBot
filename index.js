const dotenv = require('dotenv');
dotenv.config();

const { ethers } = require('ethers');
const BigNumber = require('bignumber.js');
const Paraswap = require('./paraswap');

const REST_TIME = 5 * 1000; // 5 seconds
const MAINNET_NETWORK_ID = 1;
const POLYGON_NETWORK_ID = 137;
const slippage = 0.03;

const providerURLs = {
  [MAINNET_NETWORK_ID]: process.env.HTTP_PROVIDER_MAINNET,
  [POLYGON_NETWORK_ID]: process.env.HTTP_PROVIDER_POLYGON,
};

const privatekey = {
  [MAINNET_NETWORK_ID]: process.env.PK_MAINNET,
  [POLYGON_NETWORK_ID]: process.env.PK_POLYGON,
};

// Any arbitary token can be used.
// We use ETH <> MATIC as they are native tokens
// and don't require any approval on their chains
const Tokens = {
  [MAINNET_NETWORK_ID]: {
    ETH: {
      address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
      decimals: 18,
    },
    MATIC: {
      address: '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0',
      decimals: 18,
    },
  },
  [POLYGON_NETWORK_ID]: {
    MATIC: {
      address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
      decimals: 18,
    },
    ETH: {
      address: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619', // Its actually WETH
      decimals: 18,
    },
  },
};

class CrossChainArbinator {
  constructor(pricing, wallets) {
    this.pricing = pricing;
    this.wallets = wallets;
  }

  async alive() {
    try {
      await this.run();
    } catch (e) {
      console.error(`Error_CrossChainArbinator_alive:`, e);
    }
    return await this.alive();
  }

  async executeTx(txRequest, network) {
    const tx = await this.wallets[network].sendTransaction(txRequest);
    return await tx.wait(); 
  }

  async rebalance() {
    // TODO: complete me
  }

  normalise(amount, token) {
    return new BigNumber(amount).times(new BigNumber(10).pow(token.decimals));
  }

  denormalise(amount, token) {
    return new BigNumber(amount).div(new BigNumber(10).pow(token.decimals));
  }

  // Bot logic goes here
  async run() {
    const srcAmountFirst = this.normalise(
      '0.05',
      Tokens[MAINNET_NETWORK_ID]['ETH'],
    );
    // Get the best price for ETH -> MATIC swap in MAINNET
    const priceFirst = await this.pricing.getPrice(
      Tokens[MAINNET_NETWORK_ID]['ETH'],
      Tokens[MAINNET_NETWORK_ID]['MATIC'],
      srcAmountFirst.toFixed(0),
      MAINNET_NETWORK_ID,
    );
    const dSrcAmountFirst = this.denormalise(
      srcAmountFirst,
      Tokens[MAINNET_NETWORK_ID]['ETH'],
    ).toFixed(4);
    const dDestAmountFirst = this.denormalise(
      priceFirst.price,
      Tokens[MAINNET_NETWORK_ID]['MATIC'],
    ).toFixed(4);
    console.log(
      `FirstSwap ETH -> MATIC MAINNET srcAmount: ${dSrcAmountFirst} destAmount: ${dDestAmountFirst}`,
    );
    // Get the destAmount with slippage to get the srcAmount of the next swap
    const destAmountFirstSlippage = new BigNumber(priceFirst.price).times(
      1 - slippage,
    );

    // Get the best price for MATIC -> ETH swap in POLYGON
    const priceSecond = await this.pricing.getPrice(
      Tokens[POLYGON_NETWORK_ID]['MATIC'],
      Tokens[POLYGON_NETWORK_ID]['ETH'],
      destAmountFirstSlippage.toFixed(0),
      POLYGON_NETWORK_ID,
    );
    const dSrcAmountSecond = this.denormalise(
      destAmountFirstSlippage,
      Tokens[POLYGON_NETWORK_ID]['MATIC'],
    ).toFixed(4);
    const dDestAmountSecond = this.denormalise(
      priceSecond.price,
      Tokens[POLYGON_NETWORK_ID]['ETH'],
    ).toFixed(4);
    console.log(
      `SecondSwap MATIC -> ETH MAINNET srcAmount: ${dSrcAmountSecond} destAmount: ${dDestAmountSecond}`,
    );
    // Get the destAmount with slippage to check if have an arbitrage opportunity
    const destAmountSecondSlippage = new BigNumber(priceSecond.price).times(
      1 - slippage,
    );

    // If the amount recieved in the second swap - slippage is greater than the src amount of the first swap 
    const isArb = srcAmountFirst.lte(destAmountSecondSlippage);
    console.log(`Is Arbitrage: ${isArb}`);
    if (isArb) {
      // Build transaction parallely for both the swaps
      const [txRequestMainnet, txRequestPolygon] = await Promise.all([
        this.pricing.buildTransaction(
          priceFirst.payload,
          Tokens[MAINNET_NETWORK_ID]['ETH'],
          Tokens[MAINNET_NETWORK_ID]['MATIC'],
          srcAmountFirst.toFixed(0),
          destAmountFirstSlippage.toFixed(0),
          MAINNET_NETWORK_ID,
          this.wallets[MAINNET_NETWORK_ID].address,
        ),
        this.pricing.buildTransaction(
          priceSecond.payload,
          Tokens[POLYGON_NETWORK_ID]['MATIC'],
          Tokens[POLYGON_NETWORK_ID]['ETH'],
          destAmountFirstSlippage.toFixed(0),
          destAmountSecondSlippage.toFixed(0),
          POLYGON_NETWORK_ID,
          this.wallets[POLYGON_NETWORK_ID].address,
        ),
      ]);
      console.log('Executing Arbitrage');
      
      // Execute the transaction 
      const txs = await Promise.all([
        this.executeTx(txRequestMainnet, MAINNET_NETWORK_ID),
        this.executeTx(txRequestPolygon, POLYGON_NETWORK_ID),
      ]);
      console.log(txs);
      
      // Rebalance the portfolio if needed
      await this.rebalance();
    } else {
      // If there was no arbitrage take rest before trying
      await new Promise(resolve => {
        setTimeout(() => resolve(), REST_TIME);
      });
    }
  }
}

async function main() {
  const providers = {
    [MAINNET_NETWORK_ID]: new ethers.providers.JsonRpcProvider(
      providerURLs[MAINNET_NETWORK_ID],
    ),
    [POLYGON_NETWORK_ID]: new ethers.providers.JsonRpcProvider(
      providerURLs[POLYGON_NETWORK_ID],
    ),
  };
  const wallets = {
    [MAINNET_NETWORK_ID]: new ethers.Wallet(
      privatekey[MAINNET_NETWORK_ID],
      providers[MAINNET_NETWORK_ID],
    ),
    [POLYGON_NETWORK_ID]: new ethers.Wallet(
      privatekey[POLYGON_NETWORK_ID],
      providers[POLYGON_NETWORK_ID],
    ),
  };

  const paraswap = new Paraswap();
  const bot = new CrossChainArbinator(paraswap, wallets);
  // Let the bot make some money ;) 
  await bot.alive();
}

main();
