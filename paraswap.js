const axios = require('axios');
const BigNumber = require('bignumber.js');

const ParswapURL = 'https://apiv5.paraswap.io';

// https://developers.paraswap.network/
class Paraswap {
  constructor(apiURL = ParswapURL) {
    this.apiURL = apiURL;
    this.referrer = 'arb-bot';
  }

  async getPrice(srcToken, destToken, srcAmount, network) {
    // TODO: Add error handling
    try {
      const requestURL =
        `${this.apiURL}/prices/?srcToken=${srcToken.address}&destToken=${destToken.address}` +
        `&amount=${srcAmount}&srcDecimals=${srcToken.decimals}&destDecimals` +
        `=${destToken.decimals}&side=SELL&network=${network}`;
      const { data } = await axios.get(requestURL, {
        headers: {
          'partner': this.referrer,
        },
      });
      return {
        price: data.priceRoute.destAmount,
        payload: data.priceRoute,
      };
    } catch (e) {
      throw new Error(
        `Paraswap unable to fetch price ${srcToken.address} ${destToken.address} ${network} ${e.message}`,
      );
    }
  }

  async buildTransaction(
    pricePayload,
    srcToken,
    destToken,
    srcAmount,
    minDestAmount,
    network,
    userAddress,
  ) {
    try {
      const requestURL = `${this.apiURL}/transactions/${network}`;
      const requestData = {
        priceRoute: pricePayload,
        srcToken: srcToken.address,
        destToken: destToken.address,
        srcAmount: srcAmount,
        destAmount: minDestAmount,
        userAddress: userAddress,
        referrer: this.referrer,
        srcDecimals: srcToken.decimals,
        destDecimals: destToken.decimals,
      };

      const { data } = await axios.post(requestURL, requestData);
      return {
        srcToken: data.srcToken,
        destToken: data.destToken,
        data: data.data,
        gasLimit: '0x' + new BigNumber(data.gas).toString(16),
        value: '0x' + new BigNumber(data.value).toString(16)
      };
    } catch (e) {
      throw new Error(
        `Paraswap unable to buildTransaction ${srcToken.address} ${destToken.address} ${network} ${e.message}`,
      );
    }
  }
}

module.exports = Paraswap;
