import numpy as np
import pandas as pd


class ZipLocator:
    """Converte um prefixo de CEP (5 primeiros dígitos) em coordenada e cidade.

    Só conhecemos os prefixos que aparecem na base da Olist. Para um prefixo fora
    da base usamos o numericamente mais próximo: os CEPs brasileiros são
    sequenciais por região, então vizinhos numéricos costumam ser vizinhos reais.
    O resultado indica quando houve essa aproximação (`approximated`).
    """

    def __init__(self, deliveries: pd.DataFrame, cities: pd.DataFrame):
        sides = [
            deliveries[[f"{side}_zip_prefix", f"{side}_lat", f"{side}_lng", f"{side}_city_id"]]
            .set_axis(["zip_prefix", "lat", "lng", "city_id"], axis=1)
            for side in ("customer", "seller")
        ]
        points = pd.concat(sides).dropna()

        coords = points.groupby("zip_prefix")[["lat", "lng"]].median()

        # Cidade mais frequente do prefixo (um prefixo raramente cruza cidades)
        city_by_zip = (
            points.groupby(["zip_prefix", "city_id"]).size().rename("n").reset_index()
            .sort_values("n", ascending=False)
            .drop_duplicates("zip_prefix")
            .set_index("zip_prefix")["city_id"]
        )
        names = cities.set_index("city_id")[["city_name", "state_code"]]

        table = coords.join(city_by_zip).join(names, on="city_id").sort_index()
        self._prefixes = table.index.to_numpy()
        self._lat = table["lat"].to_numpy()
        self._lng = table["lng"].to_numpy()
        self._city_name = table["city_name"].to_numpy(dtype=object)
        self._state_code = table["state_code"].to_numpy(dtype=object)

    def locate(self, zip_prefix: int) -> dict:
        pos = int(np.searchsorted(self._prefixes, zip_prefix))
        # Candidatos: o vizinho de cada lado; vence o mais próximo numericamente
        candidates = [i for i in (pos - 1, pos) if 0 <= i < len(self._prefixes)]
        i = min(candidates, key=lambda c: abs(int(self._prefixes[c]) - zip_prefix))
        return {
            "zip_prefix": zip_prefix,
            "lat": float(self._lat[i]),
            "lng": float(self._lng[i]),
            "city_name": self._city_name[i],
            "state_code": self._state_code[i],
            "approximated": int(self._prefixes[i]) != zip_prefix,
        }