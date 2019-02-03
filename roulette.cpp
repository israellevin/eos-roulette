#include <eosiolib/eosio.hpp>
#include <eosiolib/asset.hpp>
#include <eosiolib/crypto.h>
#define EOS_SYMBOL symbol("EOS", 4)

using namespace eosio;
class [[eosio::contract]] roulette : public eosio::contract{

    public:
        using contract::contract;

        roulette(name receiver, name code, datastream<const char*> ds): contract(receiver, code, ds){}

        [[eosio::action]]
            // Create a new spin to bet on.
            void spin(uint64_t seed_hash, uint32_t min_bet_time, uint32_t max_bet_time){
                require_auth(_self);
                eosio_assert(now() < max_bet_time, "max_bet_time not in the future");
                spins_indexed spins(_code, _code.value);
                auto iterator = spins.find(seed_hash);
                eosio_assert(iterator == spins.end(), "duplicate hash");
                spins.emplace(_self, [&](auto& row){
                    row.seed_hash = seed_hash;
                    row.min_bet_time = min_bet_time;
                    row.max_bet_time = max_bet_time;
                });
                eosio::print("spin created");
            }

        [[eosio::action]]
            // Bet larimers on a number towin in spin spinseedhash and add a seed.
            void bet(name user, uint64_t spinseedhash, uint64_t towin, uint64_t larimers, uint64_t seed){
                require_auth(user);
                // Get spin and velidate.
                spins_indexed spins(_code, _code.value);
                auto spins_iterator = spins.find(spinseedhash);
                eosio_assert(spins_iterator != spins.end(), "hash not found");
                uint32_t n = now();
                eosio_assert(n > spins_iterator->min_bet_time, "betting not yet started");
                eosio_assert(n < spins_iterator->max_bet_time, "betting ended");

                // Accept bet.
                char buffer[128];
                snprintf(buffer, sizeof(buffer), "3PSIK Roulette bet on %d", towin);
                action(
                    permission_level{user, "active"_n}, "eosio.token"_n, "transfer"_n,
                    // TODO Add towin in memo.
                    std::make_tuple(user, _self, asset(larimers, EOS_SYMBOL), std::string(buffer))
                ).send();

                // Write in table.
                bets_indexed bets(_code, _code.value);
                bets.emplace(user, [&](auto& row){
                    row.id = bets.available_primary_key();
                    row.spinseedhash = spinseedhash;
                    row.towin = towin;
                    row.seed = seed;
                    row.larimers = larimers;
                    row.user = user;
                });

                eosio::print("bet accepted from ", user, " on ", towin);
            }

        [[eosio::action]]
            // Pay winners of a spin.
            void pay(uint64_t spinseed){
                require_auth(_self);

                // FIXME Get the hash from the seed.
                //capi_checksum256 spinseedhash;
                //sha256((const char *)&spinseed, sizeof(uint64_t), &spinseedhash);
                //printhex(&spinseedhash, sizeof(spinseedhash));
                uint64_t spinseedhash = spinseed;

                // Get the spin and validate.
                spins_indexed spins(_code, _code.value);
                auto spins_iterator = spins.find(spinseedhash);
                eosio_assert(spins_iterator != spins.end(), "matching hash not found");
                // FIXME Disabled for debug.
                //eosio_assert(now() > spins_iterator->max_bet_time, "betting not yet ended");

                // Get all user seeds.
                bets_indexed bets(_code, _code.value);
                // FIXME Iterate according to secondary index, only for bets on this hash.
                //auto bets_spin_index = bets.get_index("by_spin");
                //auto bets_iterator = bets_spin_index.begin();
                //auto bets_iterator = bets_spin_index.find(spinseedhash);
                //while(bets_iterator != bets.end()){
                //    bets_iterator = bets.erase(bets_iterator);
                //}
                std::vector<uint64_t> betsToDelete;
                for(auto& bet : bets) {
                    if(bet.spinseedhash != spinseedhash) continue;
                    spinseed += bet.seed;
                    betsToDelete.push_back(bet.id);
                }

                // Calculate winning number.
                // FIXME Should be uint8_t
                uint64_t winner = 0;
                capi_checksum256 spinchecksum;
                sha256((const char *)&spinseed, sizeof(uint64_t), &spinchecksum);
                for(uint32_t i = 0; i < 32; ++i) winner = winner * 256 + spinchecksum.hash[i];
                // FIXME Try something like this?
                //int num = *((int*)&spinchecksum.hash) & INT_MAX; // 0x7FFFFFFF
                winner %= 37;
                eosio::print("winning number is: ", winner);

                // FIXME Iterate according to secondary index, only for winning bets on this hash.
                for(auto& bet : bets){
                    if(bet.spinseedhash != spinseedhash) continue;
                    if(bet.towin != winner) continue;
                    // Pay winner.
                    action(
                        permission_level{_self, "active"_n}, "eosio.token"_n, "transfer"_n,
                        std::make_tuple(_self, bet.user, asset(bet.larimers * 36, EOS_SYMBOL), std::string("3PSIK Roulette winnings!"))
                    ).send();
                }

                // Erase the bets and the spin.
                for(uint64_t id : betsToDelete){
                    auto bets_iterator = bets.find(id);
                    if(bets_iterator != bets.end()) bets.erase(bets_iterator);
                }
                spins.erase(spins_iterator);
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

    private:

        // Spins table - indexed by hash.
        struct [[eosio::table]] spin_indexed{
            uint64_t seed_hash;
            uint32_t min_bet_time;
            uint32_t max_bet_time;
            uint64_t primary_key() const {return seed_hash;}
        };
        typedef eosio::multi_index<"spins"_n, spin_indexed> spins_indexed;

        // Bets table - indexed by incrementing id with a few secondary indices.
        struct [[eosio::table]] bet_indexed{
            uint64_t id;
            uint64_t spinseedhash;
            // FIXME Should be uint8_t
            uint64_t towin;
            uint64_t seed;
            uint64_t larimers;
            name user;
            uint64_t primary_key() const {return id;}
            uint64_t by_spin() const {return spinseedhash;}
            uint64_t by_towin() const {return towin;}
            uint64_t by_user() const {return user.value;}
        };
        typedef eosio::multi_index<"bets"_n, bet_indexed, indexed_by<"spinseedhash"_n, const_mem_fun<bet_indexed, uint64_t, &bet_indexed::by_spin>>, indexed_by<"towin"_n, const_mem_fun<bet_indexed, uint64_t, &bet_indexed::by_towin>>, indexed_by<"user"_n, const_mem_fun<bet_indexed, uint64_t, &bet_indexed::by_user>>> bets_indexed;
};

// TODO Add modify bet.
EOSIO_DISPATCH(roulette, (spin)(bet)(pay)(deleteall))
