const backOffSecond = (nonce: number) => {
  const factor = Math.random() * 0.2 + 1;
  const MAX = 600;
  if (2 ** nonce < MAX) {
    return 2 ** nonce * factor;
  } else {
    return MAX * factor;
  }
}

export default backOffSecond;