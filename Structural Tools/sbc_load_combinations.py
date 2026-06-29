def generate_sbc_combinations(actions):
    """
    actions: dict of un-factored load cases with 'P', 'M' and 'V' values.
    Returns the enveloping Pu, Mu and Vu.
    """
    D_P = actions.get("D", {}).get("P", 0.0)
    D_M = actions.get("D", {}).get("M", 0.0)
    D_V = actions.get("D", {}).get("V", 0.0)
    
    L_P = actions.get("L", {}).get("P", 0.0)
    L_M = actions.get("L", {}).get("M", 0.0)
    L_V = actions.get("L", {}).get("V", 0.0)
    
    Lr_P = max(actions.get("Lr", {}).get("P", 0.0), actions.get("R", {}).get("P", 0.0), actions.get("S", {}).get("P", 0.0))
    Lr_M = max(actions.get("Lr", {}).get("M", 0.0), actions.get("R", {}).get("M", 0.0), actions.get("S", {}).get("M", 0.0))
    Lr_V = max(actions.get("Lr", {}).get("V", 0.0), actions.get("R", {}).get("V", 0.0), actions.get("S", {}).get("V", 0.0))
    
    W_P = actions.get("W", {}).get("P", 0.0)
    W_M = actions.get("W", {}).get("M", 0.0)
    W_V = actions.get("W", {}).get("V", 0.0)
    
    E_P = actions.get("E", {}).get("P", 0.0)
    E_M = actions.get("E", {}).get("M", 0.0)
    E_V = actions.get("E", {}).get("V", 0.0)
    
    combinations = []
    
    def add_combo(P_val, M_val, V_val, name):
        combinations.append({"name": name, "P": P_val, "M": M_val, "V": V_val})

    # 1. 1.4D
    add_combo(1.4 * D_P, 1.4 * D_M, 1.4 * D_V, "1.4D")
    
    # 2. 1.2D + 1.6L + 0.5(Lr or S or R)
    add_combo(1.2 * D_P + 1.6 * L_P + 0.5 * Lr_P,
              1.2 * D_M + 1.6 * L_M + 0.5 * Lr_M, 
              1.2 * D_V + 1.6 * L_V + 0.5 * Lr_V, "1.2D + 1.6L + 0.5Lr")
              
    # 3. 1.2D + 1.6(Lr or S or R) + (L or 0.5W)
    add_combo(1.2 * D_P + 1.6 * Lr_P + max(L_P, 0.5 * W_P),
              1.2 * D_M + 1.6 * Lr_M + max(L_M, 0.5 * W_M),
              1.2 * D_V + 1.6 * Lr_V + max(L_V, 0.5 * W_V), "1.2D + 1.6Lr + max(L, 0.5W)")
              
    # 4. 1.2D + 1.0W + L + 0.5(Lr or S or R)
    add_combo(1.2 * D_P + 1.0 * W_P + 1.0 * L_P + 0.5 * Lr_P,
              1.2 * D_M + 1.0 * W_M + 1.0 * L_M + 0.5 * Lr_M,
              1.2 * D_V + 1.0 * W_V + 1.0 * L_V + 0.5 * Lr_V, "1.2D + 1.0W + L + 0.5Lr")
              
    # 5. 1.2D + 1.0E + L + 0.2S
    S_P = actions.get("S", {}).get("P", 0.0)
    S_M = actions.get("S", {}).get("M", 0.0)
    S_V = actions.get("S", {}).get("V", 0.0)
    add_combo(1.2 * D_P + 1.0 * E_P + 1.0 * L_P + 0.2 * S_P,
              1.2 * D_M + 1.0 * E_M + 1.0 * L_M + 0.2 * S_M,
              1.2 * D_V + 1.0 * E_V + 1.0 * L_V + 0.2 * S_V, "1.2D + 1.0E + L + 0.2S")
              
    # 6. 0.9D + 1.0W
    add_combo(0.9 * D_P + 1.0 * W_P, 0.9 * D_M + 1.0 * W_M, 0.9 * D_V + 1.0 * W_V, "0.9D + 1.0W")
    
    # 7. 0.9D + 1.0E
    add_combo(0.9 * D_P + 1.0 * E_P, 0.9 * D_M + 1.0 * E_M, 0.9 * D_V + 1.0 * E_V, "0.9D + 1.0E")
    
    Pu = max(c["P"] for c in combinations)
    Mu = max(c["M"] for c in combinations)
    Vu = max(c["V"] for c in combinations)
    
    governing_P = max(combinations, key=lambda x: x["P"])
    governing_M = max(combinations, key=lambda x: x["M"])
    governing_V = max(combinations, key=lambda x: x["V"])
    
    return {
        "Pu": Pu,
        "Mu": Mu,
        "Vu": Vu,
        "governing_P_combo": governing_P["name"],
        "governing_M_combo": governing_M["name"],
        "governing_V_combo": governing_V["name"],
        "all_combinations": combinations
    }
