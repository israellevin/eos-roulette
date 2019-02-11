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
            void spin(checksum256 seedhash, uint32_t minbettime, uint32_t maxbettime){
                require_auth(_self);

                // Try to get the spin.
                spins_indexed spins(_code, _code.value);
                auto spins_seedhash_index = spins.get_index<"seedhash"_n>();
                auto spins_iterator = spins_seedhash_index.find(seedhash);

                // Validate.
                eosio_assert(spins_iterator == spins_seedhash_index.end(), "duplicate hash");
                eosio_assert(now() < maxbettime, "maxbettime not in the future");

                // Write in table.
                spins.emplace(_self, [&](auto& row){
                    row.id = spins.available_primary_key();
                    row.seedhash = seedhash;
                    row.minbettime = minbettime;
                    row.maxbettime = maxbettime;
                });
            }

        [[eosio::action]]
            // Bet larimers on a number towin in spin seedhash and add a salt.
            void bet(name user, checksum256 seedhash, uint8_t towin, uint64_t larimers, uint64_t salt){
                require_auth(user);

                // Try to get the spin.
                spins_indexed spins(_code, _code.value);
                auto spins_seedhash_index = spins.get_index<"seedhash"_n>();
                auto spins_iterator = spins_seedhash_index.find(seedhash);

                // validate.
                eosio_assert(spins_iterator != spins_seedhash_index.end(), "hash not found");
                uint32_t n = now();
                eosio_assert(n > spins_iterator->minbettime, "betting not yet started");
                eosio_assert(n < spins_iterator->maxbettime, "betting ended");

                // Accept bet.
                char memo[128];
                snprintf(memo, sizeof(memo), "3PSIK Roulette bet on %d", towin);
                action(
                    permission_level{user, "active"_n}, "eosio.token"_n, "transfer"_n,
                    std::make_tuple(user, _self, asset(larimers, EOS_SYMBOL), std::string(memo))
                ).send();

                // Write in table.
                bets_indexed bets(_code, _code.value);
                bets.emplace(user, [&](auto& row){
                    row.id = bets.available_primary_key();
                    row.seedhash = seedhash;
                    row.towin = towin;
                    row.salt = salt;
                    row.larimers = larimers;
                    row.user = user;
                });
            }

        [[eosio::action]]
            // Pay winners of a spin.
            void pay(checksum256 seed){
                require_auth(_self);

                checksum256 seedhash = sha256((const char *)&seed, sizeof(seed));

                // Try to get the spin.
                spins_indexed spins(_code, _code.value);
                auto spins_seedhash_index = spins.get_index<"seedhash"_n>();
                auto spins_iterator = spins_seedhash_index.find(seedhash);

                // Validate.
                eosio_assert(spins_iterator != spins_seedhash_index.end(), "matching hash not found");
                eosio_assert(now() > spins_iterator->maxbettime, "betting not yet ended");

                // Bets iterator tools.
                bets_indexed bets(_code, _code.value);
                auto bets_spin_index = bets.get_index<"seedhash"_n>();

                // Combine seed with all user salts.
                seednsalt_struct seednsalt;
                seednsalt.seed = seed;
                for(
                    auto bets_iterator = bets_spin_index.find(seedhash);
                    bets_iterator != bets_spin_index.end();
                    bets_iterator++
                ){
                    seednsalt.salts.push_back(bets_iterator->salt);
                }

                // Calculate winning number.
                uint64_t winner = 0;
                checksum256 seednsalt_hash = sha256((const char *)&seednsalt, sizeof(seednsalt));
                char* hash_char = (char*)&seednsalt_hash;
                uint8_t hash_size = sizeof(seednsalt_hash);
                uint8_t char_value;
                for(int i=0; i < hash_size; i++){
                    char_value = (uint8_t)hash_char[(hash_size / 2 + hash_size - 1 - i) % hash_size];
                    winner = winner * 256 + char_value;
                }
                winner = winner % 37;
                print("winning number is: ", winner);

                // Handle bettors.
                for(auto bets_iterator = bets_spin_index.find(seedhash); bets_iterator != bets_spin_index.end(); bets_iterator++){
                    // Notifify bettor.
                    action(
                        permission_level{_self, "active"_n}, _self, "notify"_n,
                        std::make_tuple(bets_iterator->user, winner, seedhash)
                    ).send();

                    // Pay if winner.
                    if(bets_iterator->towin == winner){
                        action(
                            permission_level{_self, "active"_n}, "eosio.token"_n, "transfer"_n,
                            std::make_tuple(_self, bets_iterator->user, asset(bets_iterator->larimers * 36, EOS_SYMBOL), std::string("3PSIK Roulette winnings!"))
                        ).send();
                    }
                }

                // Erase the bets and the spin.
                for(
                    auto bets_iterator = bets_spin_index.find(seedhash);
                    bets_iterator != bets_spin_index.end();
                    bets_iterator = bets_spin_index.erase(bets_iterator)
                );
                spins_seedhash_index.erase(spins_iterator);
            }

        [[eosio::action]]
            // Send spin result to bettor.
            void notify(name user, uint8_t winner, checksum256 seedhash){
                require_auth(_self);
                require_recipient(user);
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
            void gethash(checksum256 seed){
                print(checksum256_to_hex(sha256((const char*)&seed, sizeof(seed))));
            }

    private:

        // Spins table - indexed by hash.
        struct [[eosio::table]] spin_indexed{
            uint64_t id;
            checksum256 seedhash;
            uint32_t minbettime;
            uint32_t maxbettime;
            uint64_t primary_key() const {return id;}
            checksum256 by_seedhash() const {return seedhash;}
            uint64_t by_maxbettime() const {return maxbettime;}
        };
        typedef multi_index<"spins"_n, spin_indexed, indexed_by<"seedhash"_n, const_mem_fun<spin_indexed, checksum256, &spin_indexed::by_seedhash>>, indexed_by<"maxbettime"_n, const_mem_fun<spin_indexed, uint64_t, &spin_indexed::by_maxbettime>>> spins_indexed;

        // Bets table - indexed by incrementing id and seedhash.
        struct [[eosio::table]] bet_indexed{
            uint64_t id;
            checksum256 seedhash;
            uint8_t towin;
            uint64_t salt;
            uint64_t larimers;
            name user;
            uint64_t primary_key() const {return id;}
            checksum256 by_seedhash() const {return seedhash;}
        };
        typedef multi_index<"bets"_n, bet_indexed, indexed_by<"seedhash"_n, const_mem_fun<bet_indexed, checksum256, &bet_indexed::by_seedhash>>> bets_indexed;

        // Seed and salts, for hashing.
        struct seednsalt_struct{
            checksum256 seed;
            std::vector<uint64_t> salts;
        };

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

EOSIO_DISPATCH(roulette, (spin)(bet)(pay)(notify)(deleteall)(gethash))
