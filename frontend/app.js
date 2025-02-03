let votingContract;
let tokenContract;
let signer;
let provider;

// Add ERC20 Token ABI
const tokenABI = [
    // Basic ERC20 functions we need
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    // Events
    "event Transfer(address indexed from, address indexed to, uint256 value)",
    "event Approval(address indexed owner, address indexed spender, uint256 value)"
];

async function switchToLocalNetwork() {
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x539' }], // 1337 in hex
        });
    } catch (switchError) {
        // This error code indicates that the chain has not been added to MetaMask.
        if (switchError.code === 4902) {
            try {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [
                        {
                            chainId: '0x539', // 1337 in hex
                            chainName: 'Localhost 8545',
                            nativeCurrency: {
                                name: 'ETH',
                                symbol: 'ETH',
                                decimals: 18
                            },
                            rpcUrls: ['http://127.0.0.1:8545'],
                        },
                    ],
                });
            } catch (addError) {
                showError('Failed to add the local network to MetaMask: ' + addError.message);
            }
        } else {
            showError('Failed to switch to the local network: ' + switchError.message);
        }
    }
}

async function connectWallet() {
    try {
        if (!window.ethereum) {
            throw new Error("Please install MetaMask to use this dApp!");
        }

        // First, try to switch to the local network
        await switchToLocalNetwork();

        provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        signer = provider.getSigner();
        
        const config = await fetch('./config.json').then(response => response.json());
        
        votingContract = new ethers.Contract(config.contract_address, config.abi, signer);
        tokenContract = new ethers.Contract(config.tokenEC20_address, tokenABI, signer);
        
        const address = await signer.getAddress();
        const balance = await provider.getBalance(address);
        const tokenBalance = await tokenContract.balanceOf(address);
        
        document.getElementById('accountInfo').innerHTML = `
            <p>Connected: ${address}</p>
            <p>ETH Balance: ${ethers.utils.formatEther(balance)} ETH</p>
            <p>Token Balance: ${ethers.utils.formatEther(tokenBalance)} VOTE</p>
        `;
        
        // Load initial data
        await loadCandidates();
        await updateStakedAmount();
        
        listenToEvents();

        // Add network change listener
        window.ethereum.on('chainChanged', (chainId) => {
            window.location.reload();
        });

        // Add account change listener
        window.ethereum.on('accountsChanged', (accounts) => {
            window.location.reload();
        });
        
    } catch (error) {
        showError("Failed to connect wallet: " + error.message);
    }
}

async function loadCandidates() {
    try {
        const candidatesList = document.getElementById('candidatesList');
        candidatesList.innerHTML = '<h3>Candidates</h3>';
        
        const count = await votingContract.candidateCount();
        let totalVotes = 0;
        const candidates = [];
        
        // First pass to get total votes
        for(let i = 0; i < count.toNumber(); i++) {
            const [name, votes] = await votingContract.getCandidate(i);
            totalVotes += votes.toNumber();
            candidates.push({ id: i, name, votes: votes.toNumber() });
        }
        
        // Second pass to display with percentages
        for(const candidate of candidates) {
            const percentage = totalVotes > 0 ? 
                await votingContract.calculateVotePercentage(candidate.votes, totalVotes) : 0;
            
            const hasVoted = await votingContract.hasVoted(await signer.getAddress());
            
            const candidateElement = document.createElement('div');
            candidateElement.className = 'candidate';
            candidateElement.innerHTML = `
                <div class="candidate-info">
                    <p>ID: ${candidate.id} - ${candidate.name}</p>
                    <p>Votes: ${candidate.votes} (${percentage}%)</p>
                </div>
                ${!hasVoted ? `
                    <button onclick="vote(${candidate.id})" class="vote-button">
                        Vote for ${candidate.name}
                    </button>
                ` : ''}
            `;
            candidatesList.appendChild(candidateElement);
        }
    } catch (error) {
        showError("Failed to load candidates: " + error.message);
    }
}

async function stake() {
    try {
        const amount = document.getElementById('stakeAmount').value;
        if (!amount || amount <= 0) {
            throw new Error("Please enter a valid stake amount");
        }
        
        // Estimate gas
        const value = ethers.utils.parseEther(amount);
        const gasEstimate = await votingContract.estimateGas.stake({ value });
        const gasPrice = await provider.getGasPrice();
        const gasCost = gasEstimate.mul(gasPrice);
        
        showSuccess(`Estimated gas cost: ${ethers.utils.formatEther(gasCost)} ETH`);
        
        const tx = await votingContract.stake({
            value: value,
            gasLimit: Math.ceil(gasEstimate.toNumber() * 1.2) // 20% buffer
        });
        
        showSuccess("Staking transaction sent! Hash: " + tx.hash);
        await tx.wait();
        showSuccess("Stake successful!");
        
        await updateStakedAmount();
        await updateWalletInfo();
        
    } catch (error) {
        showError("Staking failed: " + error.message);
    }
}

async function vote(candidateId) {
    try {
        const stakedAmount = await votingContract.stakedAmount(await signer.getAddress());
        if (stakedAmount.eq(0)) {
            throw new Error("You must stake ETH before voting");
        }
        
        // Estimate gas
        const gasEstimate = await votingContract.estimateGas.vote(candidateId);
        const gasPrice = await provider.getGasPrice();
        const gasCost = gasEstimate.mul(gasPrice);
        
        showSuccess(`Estimated gas cost: ${ethers.utils.formatEther(gasCost)} ETH`);
        
        const tx = await votingContract.vote(candidateId, {
            gasLimit: Math.ceil(gasEstimate.toNumber() * 1.2)
        });
        
        showSuccess("Vote transaction sent! Hash: " + tx.hash);
        await tx.wait();
        showSuccess("Vote successful! You received reward tokens!");
        
        await loadCandidates();
        await updateWalletInfo();
    } catch (error) {
        showError("Voting failed: " + error.message);
    }
}

async function withdraw() {
    try {
        const stakedAmount = await votingContract.stakedAmount(await signer.getAddress());
        if (stakedAmount.eq(0)) {
            throw new Error("No ETH staked to withdraw");
        }
        
        // Estimate gas
        const gasEstimate = await votingContract.estimateGas.withdraw();
        const gasPrice = await provider.getGasPrice();
        const gasCost = gasEstimate.mul(gasPrice);
        
        showSuccess(`Estimated gas cost: ${ethers.utils.formatEther(gasCost)} ETH`);
        
        const tx = await votingContract.withdraw();
        showSuccess("Withdrawal transaction sent! Hash: " + tx.hash);
        await tx.wait();
        showSuccess("Withdrawal successful!");
        
        await updateStakedAmount();
        await updateWalletInfo();
        
    } catch (error) {
        showError("Withdrawal failed: " + error.message);
    }
}

async function updateStakedAmount() {
    try {
        const address = await signer.getAddress();
        const amount = await votingContract.stakedAmount(address);
        document.getElementById('stakedInfo').innerHTML = 
            `Staked Amount: ${ethers.utils.formatEther(amount)} ETH`;
    } catch (error) {
        console.error("Failed to update staked amount:", error);
    }
}

async function updateWalletInfo() {
    try {
        const address = await signer.getAddress();
        const balance = await provider.getBalance(address);
        const tokenBalance = await tokenContract.balanceOf(address);
        
        document.getElementById('accountInfo').innerHTML = `
            <p>Connected: ${address}</p>
            <p>ETH Balance: ${ethers.utils.formatEther(balance)} ETH</p>
            <p>Token Balance: ${ethers.utils.formatEther(tokenBalance)} VOTE</p>
        `;
    } catch (error) {
        console.error("Failed to update wallet info:", error);
    }
}

function showError(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

function showSuccess(message) {
    const successDiv = document.getElementById('success');
    successDiv.textContent = message;
    successDiv.style.display = 'block';
    setTimeout(() => {
        successDiv.style.display = 'none';
    }, 5000);
}

function listenToEvents() {
    votingContract.on("VoteCasted", (voter, candidateId) => {
        showSuccess(`New vote from ${voter} for candidate ${candidateId}`);
        loadCandidates();
        updateWalletInfo();
    });

    votingContract.on("Staked", (user, amount) => {
        showSuccess(`New stake from ${user} of ${ethers.utils.formatEther(amount)} ETH`);
        updateStakedAmount();
        updateWalletInfo();
    });

    votingContract.on("Withdrawn", (user, amount) => {
        showSuccess(`Withdrawal by ${user} of ${ethers.utils.formatEther(amount)} ETH`);
        updateStakedAmount();
        updateWalletInfo();
    });
}

async function debugContract() {
    try {
        const address = await signer.getAddress();
        const tokenBalance = await tokenContract.balanceOf(address);
        const votingSystemBalance = await tokenContract.balanceOf(votingContract.address);
        
        showSuccess(`
            Your Token Balance: ${ethers.utils.formatEther(tokenBalance)} VOTE
            Voting System Token Balance: ${ethers.utils.formatEther(votingSystemBalance)} VOTE
            Token Contract Address: ${tokenContract.address}
        `);
    } catch (error) {
        showError("Debug failed: " + error.message);
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('connectWallet').addEventListener('click', connectWallet);
    document.getElementById('stakeButton').addEventListener('click', stake);
    document.getElementById('withdrawButton').addEventListener('click', withdraw);
    document.getElementById('debugButton').addEventListener('click', debugContract);
    document.getElementById('refreshButton').addEventListener('click', loadCandidates);
});
