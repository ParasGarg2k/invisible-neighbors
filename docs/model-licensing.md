# Model provenance and licensing

BirdNET is developed by the Cornell Lab of Ornithology and Chemnitz University of Technology.

## Runtime model source

- [Official BirdNET v2.4 release](https://doi.org/10.5281/zenodo.15050749)
- [Runtime TensorFlow.js archive endpoint](https://zenodo.org/api/records/15050749/files/BirdNET_v2.4_tfjs.zip/content)
- [BirdNET-Analyzer source code and license information](https://github.com/birdnet-team/BirdNET-Analyzer)

The browser downloads the archive when analysis is requested. Model weights are not bundled with the application, committed to the repository, or fetched during installation or builds.

Spectrogram preprocessing follows the official TensorFlow.js release's `MelSpecLayerSimple` contract. No remote JavaScript from the archive is evaluated.

## Separate licenses

Application code is MIT licensed. BirdNET source code is also MIT licensed, but its model assets have separate terms.

BirdNET's repository states that its models are **CC BY-NC-SA 4.0**. The Zenodo record was observed to list **CC BY-NC 4.0**, so upstream license metadata differs. Follow the specific asset's terms, retain attribution, and clarify redistribution, commercial use, or contest use with the maintainers when necessary. This project does not relicense or redistribute model weights.

The maintainers permit educational and research use. An open-source application license does not override a model's noncommercial restrictions. Eligibility for a prize competition has not been confirmed by the maintainers or organizers.

User recordings retain their own rights. The field photograph has separate attribution in [public/ASSETS.md](../public/ASSETS.md).

## Citation

Kahl, S., Wood, C. M., Eibl, M., & Klinck, H. (2021). _BirdNET: A deep learning solution for avian diversity monitoring_. Ecological Informatics, 61, 101236.
