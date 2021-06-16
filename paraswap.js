const axios = require('axios');
const BigNumber = require('bignumber.js');

const ParswapURL = 'https://apiv4.paraswap.io/v2';

// https://developers.paraswap.network/
class Paraswap {
  constructor(apiURL = ParswapURL) {
    this.apiURL = apiURL;
    this.referrer = 'arb-bot';
  }

  async getPrice(from, to, srcAmount, network) {
    // TODO: Add error handling
    try {
      const requestURL =
        `${this.apiURL}/prices/?from=${from.address}&to=${to.address}` +
        `&amount=${srcAmount}&fromDecimals=${from.decimals}&toDecimals` +
        `=${to.decimals}&side=SELL&network=${network}`;
      const { data } = await axios.get(requestURL, {
        headers: {
          'X-Partner': this.referrer,
        },
      });
      return {
        price: data.priceRoute.destAmount,
        payload: data.priceRoute,
      };
    } catch (e) {
      throw new Error(
        `Paraswap unable to fetch price ${from.address} ${to.address} ${network} ${e.message}`,
      );
    }
  }

  async buildTransaction(
    pricePayload,
    from,
    to,
    srcAmount,
    minDestAmount,
    network,
    userAddress,
  ) {
    try {
      const requestURL = `${this.apiURL}/transactions/${network}`;
      const requestData = {
        priceRoute: pricePayload,
        srcToken: from.address,
        destToken: to.address,
        srcAmount: srcAmount,
        destAmount: minDestAmount,
        userAddress: userAddress,
        referrer: this.referrer,
        srcDecimals: from.decimals,
        destDecimals: to.decimals,
      };

      const { data } = await axios.post(requestURL, requestData);
      return {
        from: data.from,
        to: data.to,
        data: data.data,
        gasLimit: '0x' + new BigNumber(data.gas).toString(16),
        value: '0x' + new BigNumber(data.value).toString(16)
      };
    } catch (e) {
      throw new Error(
        `Paraswap unable to buildTransaction ${from.address} ${to.address} ${network} ${e.message}`,
      );
    }
  }
}

module.exports = Paraswap;
