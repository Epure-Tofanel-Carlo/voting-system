// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IVotingSystem {
    function addCandidate(string memory _name) external;
    function vote(uint _candidateId) external;
    function getCandidate(uint _candidateId) external view returns (string memory, uint);
}

contract VotingSystem is IVotingSystem {
    struct Candidate {
        string name;
        uint voteCount;
    }

    address public owner;
    mapping(address => bool) public hasVoted;
    mapping(uint => Candidate) public candidates;
    uint public candidateCount;
    mapping(address => uint) public stakedAmount;

    IERC20 public rewardToken;

    event VoteCasted(address indexed voter, uint candidateId);
    event CandidateAdded(string name, uint candidateId);
    event Staked(address indexed user, uint amount);
    event Withdrawn(address indexed user, uint amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    modifier hasStaked() {
        require(stakedAmount[msg.sender] > 0, "You must stake ETH to vote");
        _;
    }

    constructor(address _rewardToken) {
        owner = msg.sender;
        rewardToken = IERC20(_rewardToken);
    }

    function addCandidate(string memory _name) public onlyOwner override {
        candidates[candidateCount] = Candidate(_name, 0);
        emit CandidateAdded(_name, candidateCount);
        candidateCount++;
    }

    function vote(uint _candidateId) public hasStaked override {
        require(!hasVoted[msg.sender], "You have already voted");
        require(_candidateId < candidateCount, "Invalid candidate ID");

        hasVoted[msg.sender] = true;
        candidates[_candidateId].voteCount++;

        // Reward voters with tokens
        rewardToken.transfer(msg.sender, 10 * 10**18);

        emit VoteCasted(msg.sender, _candidateId);
    }

    function getCandidate(uint _candidateId) public view override returns (string memory, uint) {
        require(_candidateId < candidateCount, "Invalid candidate ID");
        return (candidates[_candidateId].name, candidates[_candidateId].voteCount);
    }

    function stake() public payable {
        require(msg.value > 0, "Must stake ETH");
        stakedAmount[msg.sender] += msg.value;
        emit Staked(msg.sender, msg.value);
    }

    function withdraw() public {
        uint amount = stakedAmount[msg.sender];
        require(amount > 0, "No ETH to withdraw");
        stakedAmount[msg.sender] = 0;
        payable(msg.sender).transfer(amount);
        emit Withdrawn(msg.sender, amount);
    }
}