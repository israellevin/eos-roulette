#include <eosiolib/eosio.hpp>
#include <eosiolib/asset.hpp>
#include <eosiolib/crypto.hpp>
#define EOS_SYMBOL symbol("EOS", 4)

using namespace eosio;
class [[eosio::contract]] roulette : public eosio::contract{

    public:
        using contract::contract;

        roulette(name receiver, name code, datastream<const char*> ds): contract(receiver, code, ds){}

        [[eosio::action]]
            // Create a new spin to bet on.
            void spin(checksum256 hash, uint32_t minbettime, uint32_t maxbettime){
                require_auth(_self);

                // Try to get the spin.
                spins_indexed spins(_code, _code.value);
                auto spins_hash_index = spins.get_index<"hash"_n>();
                auto spins_iterator = spins_hash_index.find(hash);

                // Validate.
                eosio_assert(spins_iterator == spins_hash_index.end(), "duplicate hash");
                eosio_assert(now() < maxbettime, "maxbettime not in the future");

                // Write in table.
                spins.emplace(_self, [&](auto& row){
                    row.id = spins.available_primary_key();
                    row.hash = hash;
                    row.minbettime = minbettime;
                    row.maxbettime = maxbettime;
                });
            }

        [[eosio::action]]
            // Bet larimers on a coverage of numbers in spin hash and add a salt.
            void bet(name user, checksum256 hash, std::vector<uint8_t> coverage, uint64_t larimers, uint64_t salt){
                name payer = user;
                if(has_auth(_self)){
                    payer = _self;
                }else{
                    require_auth(user);
                }

                // Try to get the spin.
                spins_indexed spins(_code, _code.value);
                auto spins_hash_index = spins.get_index<"hash"_n>();
                auto spins_iterator = spins_hash_index.find(hash);

                // validate.
                eosio_assert(spins_iterator != spins_hash_index.end(), "hash not found");
                eosio_assert(36 % coverage.size() == 0, "coverage size does not divide 36");
                uint32_t n = now();
                eosio_assert(n > spins_iterator->minbettime, "betting not yet started");
                eosio_assert(n < spins_iterator->maxbettime, "betting ended");

                // Accept bet.
                if(user == payer){
                    action(
                        permission_level{user, "active"_n}, "eosio.token"_n, "transfer"_n,
                        std::make_tuple(user, _self, asset(larimers, EOS_SYMBOL), std::string("Roulette bets"))
                    ).send();
                }

                // Write in table.
                bets_indexed bets(_code, _code.value);
                bets.emplace(payer, [&](auto& row){
                    row.id = bets.available_primary_key();
                    row.hash = hash;
                    row.coverage = coverage;
                    row.salt = salt;
                    row.larimers = larimers;
                    row.user = user;
                });
            }

        [[eosio::action]]
            // Pay winners of a spin.
            void pay(checksum256 secret){
                require_auth(_self);

                const checksum256 hash = sha256((const char *)&secret, sizeof(secret));

                // Try to get the spin.
                spins_indexed spins(_code, _code.value);
                auto spins_hash_index = spins.get_index<"hash"_n>();
                auto spins_iterator = spins_hash_index.find(hash);

                // Validate.
                eosio_assert(spins_iterator != spins_hash_index.end(), "matching hash not found");
                eosio_assert(now() > spins_iterator->maxbettime, "betting not yet ended");

                // Bets iterator tools.
                bets_indexed bets(_code, _code.value);
                auto bets_spin_index = bets.get_index<"hash"_n>();

                // Combine secret with all user salts.
                saltedsecret_struct saltedsecret;
                saltedsecret.secret = secret;
                for(
                    auto bets_iterator = bets_spin_index.find(hash);
                    bets_iterator != bets_spin_index.end();
                    bets_iterator++
                ){
                    saltedsecret.salts.push_back(bets_iterator->salt);
                }

                // Calculate winning number and publish it.
                uint8_t winning_number = calculate_winning_number(saltedsecret);
                SEND_INLINE_ACTION(*this, publish, {_self, "active"_n}, {hash, winning_number});

                // Pay lucky bettors.
                for(auto bets_iterator = bets_spin_index.find(hash); bets_iterator != bets_spin_index.end(); bets_iterator++){
                    uint64_t winnings = bets_iterator->larimers * 36 / bets_iterator->coverage.size();
                    for(auto const& bet_number: bets_iterator->coverage){
                        if(bet_number == winning_number){
                            action(
                                permission_level{_self, "active"_n}, "eosio.token"_n, "transfer"_n,
                                std::make_tuple(_self, bets_iterator->user, asset(winnings, EOS_SYMBOL),
                                std::string("Roulette winnings!"))
                            ).send();
                            // Should we break here? What if a user bets more than once on the same number?
                            // break;
                        }
                    }
                }

                // Erase the spin and its bets.
                spins_hash_index.erase(spins_iterator);
                auto bets_iterator = bets_spin_index.find(hash);
                while(bets_iterator != bets_spin_index.end()){
                    if(bets_iterator->hash == hash){
                        bets_iterator = bets_spin_index.erase(bets_iterator);
                    }else{
                        bets_iterator++;
                    }
                }
            }

        [[eosio::action]]
            // Publish spin result.
            void publish(checksum256 hash, uint8_t winning_number){
                require_auth(_self);
            }

        [[eosio::action]]
            // Delete both tables, for debug.
            void deleteall(){
                require_auth(_self);
                spins_indexed spins(_code, _code.value);
                auto spins_iterator = spins.begin();
                while(spins_iterator != spins.end()){
                    spins_iterator = spins.erase(spins_iterator);
                }
                bets_indexed bets(_code, _code.value);
                auto bets_iterator = bets.begin();
                while(bets_iterator != bets.end()){
                    bets_iterator = bets.erase(bets_iterator);
                }
            }

        [[eosio::action]]
            // Hash a hex string
            void gethash(checksum256 secret){
                print(checksum256_to_hex(sha256((const char*)&secret, sizeof(secret))));
            }

    private:

        // Spins table - indexed by hash.
        struct [[eosio::table]] spin_row{
            uint64_t id;
            checksum256 hash;
            uint32_t minbettime;
            uint32_t maxbettime;
            uint64_t primary_key() const {return id;}
            checksum256 by_hash() const {return hash;}
            uint64_t by_maxbettime() const {return maxbettime;}
        };
        typedef multi_index<"spins"_n, spin_row, indexed_by<"hash"_n, const_mem_fun<spin_row, checksum256, &spin_row::by_hash>>, indexed_by<"maxbettime"_n, const_mem_fun<spin_row, uint64_t, &spin_row::by_maxbettime>>> spins_indexed;

        // Bets table - indexed by incrementing id and hash.
        struct [[eosio::table]] bet_row{
            uint64_t id;
            checksum256 hash;
            std::vector<uint8_t> coverage;
            uint64_t larimers;
            uint64_t salt;
            name user;
            uint64_t primary_key() const {return id;}
            checksum256 by_hash() const {return hash;}
        };
        typedef multi_index<"bets"_n, bet_row, indexed_by<"hash"_n, const_mem_fun<bet_row, checksum256, &bet_row::by_hash>>> bets_indexed;

        // Secret and salts, for hashing.
        struct saltedsecret_struct{
            checksum256 secret;
            std::vector<uint64_t> salts;
        };

        // Get a winning roulette number from a checksum256.
        // The method is to look at the first byte of the hash - if the value
        // is below 222, modulo it by 37 and you have a winner. If the hash is
        // above, move on to the next byte and do the same thing. If you run
        // out of bytes, which is pretty unlikely, just add a new salt of 1 and
        // try again.
        uint8_t calculate_winning_number(saltedsecret_struct saltedsecret){
            checksum256 saltedsecret_hash = sha256((const char *)&saltedsecret, sizeof(saltedsecret));
            char* hash_char = (char*)&saltedsecret_hash;
            uint8_t hash_size = sizeof(saltedsecret_hash);
            uint8_t char_value;
            for(int i = 0; i < hash_size; i++){
                char_value = (uint8_t)hash_char[(hash_size / 2 + hash_size - 1 - i) % hash_size];
                if(char_value < 222){
                    return char_value % 37;
                }
            }
            saltedsecret.salts.push_back(1);
            print("adding salt. ");
            return calculate_winning_number(saltedsecret);
        }

        // Convert checksum256 to hex string.
        std::string checksum256_to_hex(checksum256 hash){
            const char* to_hex="0123456789abcdef";
            char* hash_char = (char*)&hash;
            uint8_t char_value;
            std::string result = "";
            for(int i=0; i<sizeof(hash); i++){
                char_value = (uint8_t)hash_char[(sizeof(hash) / 2 + sizeof(hash) - 1 - i) % sizeof(hash)];
                result += to_hex[char_value >> 4];
                result += to_hex[char_value & 0x0f];
            }
            return result;
        }
};

EOSIO_DISPATCH(roulette, (spin)(bet)(pay)(publish)(deleteall)(gethash))
