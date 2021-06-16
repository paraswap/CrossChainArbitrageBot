const dotenv = require("dotenv");
dotenv.config();

const { ethers } = require("ethers");
const bigNumber = require("bignumber.js");
const Paraswap = require("./pricing/paraswap");

const REST_TIME = 5 * 1000; // 5 seconds
const MAINNET_NETWORK_ID = 1;
const POLYGON_NETWORK_ID = 137;
const slippage = 0.05;

const providerURLs = {
  [MAINNET_NETWORK_ID]: process.env.HTTP_PROVIDER_MAINNET,
  [POLYGON_NETWORK_ID]: process.env.HTTP_PROVIDER_POLYGON,
};

const privatekey = {
  [MAINNET_NETWORK_ID]: process.env.PK_MAINNET,
  [POLYGON_NETWORK_ID]: process.env.PK_POLYGON,
};

const Tokens = {
  [MAINNET_NETWORK_ID]: {
    ETH: {
      address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
      decimals: 18,
    },
    MATIC: {
      address: "0xa0c68c638235ee32657e8f720a23cec1bfc77c77",
      decimals: 18,
    },
  },
  [POLYGON_NETWORK_ID]: {
    MATIC: {
      address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
      decimals: 18,
    },
    WETH: {
      address: "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
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
    await this.run();
    await this.alive();
  }

  executeTx(txRequest, network) {
    return this.wallets[network].sendTransaction(tx);
  }

  async rebalance() {
    // TODO: complete me
  }

  // Bot logic goes here
  async run() {
    const srcAmountFirst = new bigNumber("10000000000000000"); // 0.1 ETH
    const priceFirst = await this.pricing.getPrice(
      Tokens[MAINNET_NETWORK_ID]["ETH"].address,
      Tokens[MAINNET_NETWORK_ID]["ETH"].decimals,
      Tokens[MAINNET_NETWORK_ID]["MATIC"].address,
      Tokens[MAINNET_NETWORK_ID]["MATIC"].decimals,
      srcAmountFirst.toFixed(0),
      MAINNET_NETWORK_ID
    );
    console.log(
      `FirstSwap ETH -> MATIC MAINNET srcAmount: ${srcAmountFirst.toFixed(
        0
      )} destAmount: ${priceFirst.price}`
    );
    const destAmountFirstSlippage = new bignumber(priceFirst.price).times(
      1 - slippage
    );

    const priceSecond = await this.pricing.getPrice(
      Tokens[POLYGON_NETWORK_ID]["MATIC"].address,
      Tokens[POLYGON_NETWORK_ID]["MATIC"].decimals,
      Tokens[POLYGON_NETWORK_ID]["ETH"].address,
      Tokens[POLYGON_NETWORK_ID]["ETH"].decimals,
      destAmountFirstSlippage.toFixed(0),
      POLYGON_NETWORK_ID
    );
    console.log(
      `SecondSwap MATIC -> ETH MAINNET srcAmount: ${destAmountFirstSlippage.toFixed(
        0
      )} destAmount: ${priceSecond.price}`
    );
    const destAmountSecondSlippage = new BigNumber(priceSecond.price).times(
      1 - slippage
    );

    const isArb = srcAmountFirst.lte(destAmountSecondSlippage);
    console.log(`Is Arbitrage: ${isArb}`);
    if (isArb) {
      const [txRequestMainnet, txRequestPolygon] = await Promise.all([
        this.pricing.buildTransaction(
          priceFirst.payload,
          Tokens[MAINNET_NETWORK_ID]["ETH"].address,
          Tokens[MAINNET_NETWORK_ID]["ETH"].decimals,
          Tokens[MAINNET_NETWORK_ID]["MATIC"].address,
          Tokens[MAINNET_NETWORK_ID]["MATIC"].decimals,
          srcAmountFirst.toFixed(0),
          destAmountFirstSlippage.toFixed(0),
          MAINNET_NETWORK_ID,
          this.wallets[MAINNET_NETWORK_ID].address
        ),
        this.pricing.buildTransaction(
          priceSecond.payload,
          Tokens[POLYGON_NETWORK_ID]["MATIC"].address,
          Tokens[POLYGON_NETWORK_ID]["MATIC"].decimals,
          Tokens[POLYGON_NETWORK_ID]["ETH"].address,
          Tokens[POLYGON_NETWORK_ID]["ETH"].decimals,
          destAmountFirstSlippage.toFixed(0),
          destAmountSecondSlippage.toFixed(0),
          POLYGON_NETWORK_ID,
          this.wallets[POLYGON_NETWORK_ID].address
        ),
      ]);

      // TODO: handle failed tx
      const txs = await Promise.all([
        this.executeTx.executeTx(txRequestMainnet, MAINNET_NETWORK_ID),
        this.executeTx.executeTx(txRequestPolygon, POLYGON_NETWORK_ID),
      ]);

      console.log(txs);
      await this.rebalance();
    } else {
      // Take Rest
      await Promise((resolve) => {
        setTimeout(() => resolve, REST_TIME);
      });
    }
  }
}

async function main() {
  const providers = {
    [MAINNET_NETWORK_ID]: new ethers.providers.JsonRpcProvider(
      providerURLs[MAINNET_NETWORK_ID]
    ),
    [POLYGON_NETWORK_ID]: new ethers.providers.JsonRpcProvider(
      providerURLs[POLYGON_NETWORK_ID]
    ),
  };
  const wallets = {
    [MAINNET_NETWORK_ID]: new ethers.Wallet(
      privatekey[MAINNET_NETWORK_ID],
      providers[MAINNET_NETWORK_ID]
    ),
    [POLYGON_NETWORK_ID]: new ethers.Wallet(
      privatekey[POLYGON_NETWORK_ID],
      providers[POLYGON_NETWORK_ID]
    ),
  };

  const paraswap = new Paraswap();
  const bot = new CrossChainArbinator(paraswap, wallets);

  await bot.alive();
}

main();
