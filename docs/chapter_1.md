# Foreword

Rendezvous originated from an idea conceived in 2022[^1], built upon over a decade of experience in developing and contributing to unit testing and property-based testing tools. This initiative was further driven by the numerous exploits and hacks that have afflicted the crypto industry over the years.

The need for robust testing frameworks in smart contract development cannot be overstated. As blockchain technology continues to evolve, the security implications of smart contracts become increasingly complex. Rendezvous (`rv`) was created to address these challenges by providing a specialized fuzzing tool for Clarity smart contracts.

## Acknowledgements

The idea behind Rendezvous originates from several inspiring sources:

- **John Hughes**: For his pioneering work in property-based testing and the creation of QuickCheck, which laid the foundation for modern property testing. His paper, "Testing the Hard Stuff and Staying Sane"[^2], has been a significant inspiration for our approach in `rv`.

- **Jude Nelson**: For the valuable insights and methods presented in poxl[^3], demonstrating a way to write tests in Clarity.

- **Nicolas Dubien**: For creating fast-check[^4], the underlying property-based testing framework we currently use in Rendezvous.

- **Jacob Stanley**: For his lasting inspiration and contributions to property-based testing and the Hedgehog library[^5]. Jacob's legacy and influence remain a guiding force in our work.

- **Trail of Bits**: For creating Echidna[^6], which initially utilized Hedgehog, furthering the development of smart contract fuzzers.

- **Łukasz Nowicki**: For the initial discussions and ideas on this topic in 2022.

We are deeply grateful to the Stacks Open Internet Foundation for supporting our work and providing crucial assistance, and to the open-source community for their continuous support and contributions.

[^1]: Heterogeneous Clarinet Test-Suites: <https://github.com/hirosystems/clarinet/issues/398>
[^2]: Hughes, J. (2004). "Testing the Hard Stuff and Staying Sane". In Proceedings of the ACM SIGPLAN Workshop on Haskell (Haskell '04).
[^3]: poxl: <https://github.com/jcnelson/poxl>
[^4]: fast-check: <https://github.com/dubzzz/fast-check>
[^5]: hedgehog: <https://github.com/hedgehogqa>
[^6]: echidna: <https://github.com/crytic/echidna>
